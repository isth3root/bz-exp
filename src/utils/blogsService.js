import dataSource from '../config/database.js';
import Blog from '../models/Blog.js';

class BlogsService {
  async findAll() {
    const blogRepository = dataSource.getRepository(Blog);
    return blogRepository.find();
  }

  async findOne(id) {
    const blogRepository = dataSource.getRepository(Blog);
    return blogRepository.findOneBy({ id });
  }

  async create(blog) {
    const blogRepository = dataSource.getRepository(Blog);
    const newBlog = blogRepository.create(blog);
    return blogRepository.save(newBlog);
  }

  async update(id, blog) {
    const blogRepository = dataSource.getRepository(Blog);
    await blogRepository.update(id, blog);
    return this.findOne(id);
  }

  async remove(id) {
    const blogRepository = dataSource.getRepository(Blog);
    const blog = await blogRepository.findOneBy({ id });

    // Delete associated image file if exists
    if (blog && blog.image_path) {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), blog.image_path.substring(1));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await blogRepository.delete(id);
  }

  async existsByTitle(title) {
    const blogRepository = dataSource.getRepository(Blog);
    const count = await blogRepository.count({ where: { title: title } });
    return count > 0;
  }
}

export default new BlogsService();