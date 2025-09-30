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
    await blogRepository.delete(id);
  }
}

export default new BlogsService();