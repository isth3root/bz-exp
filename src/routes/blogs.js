import express from 'express';
const router = express.Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/blogs/' });
import { jwtAuth } from '../middleware/auth.js';
import blogsService from '../utils/blogsService.js';

router.get('/blogs', async (req, res) => {
  try {
    const blogs = await blogsService.findAll();
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching blogs' });
  }
});

router.get('/blogs/:id', async (req, res) => {
  try {
    const blog = await blogsService.findOne(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching blog' });
  }
});

router.post('/admin/blogs', jwtAuth, upload.single('image'), async (req, res) => {
  try {
    const blog = req.body;
    if (req.file) {
      blog.image_path = `/uploads/blogs/${req.file.filename}`;
    }
    const newBlog = await blogsService.create(blog);
    res.json(newBlog);
  } catch (error) {
    res.status(500).json({ message: 'Error creating blog' });
  }
});

router.put('/admin/blogs/:id', jwtAuth, async (req, res) => {
  try {
    const updatedBlog = await blogsService.update(req.params.id, req.body);
    if (!updatedBlog) return res.status(404).json({ message: 'Blog not found' });
    res.json(updatedBlog);
  } catch (error) {
    res.status(500).json({ message: 'Error updating blog' });
  }
});

router.delete('/admin/blogs/:id', jwtAuth, async (req, res) => {
  try {
    await blogsService.remove(req.params.id);
    res.json({ message: 'Blog deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting blog' });
  }
});

export default router;