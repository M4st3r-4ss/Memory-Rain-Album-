# Contributing to Memory Rain

Thank you for considering contributing to Memory Rain! This document provides guidelines and instructions for contributing.

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Node version, browser)

### Suggesting Features

Feature suggestions are welcome! Please:
- Check if the feature already exists
- Describe the problem it solves
- Provide examples of how it would work
- Consider backwards compatibility

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/M4st3r-4ss/girlfriend-opensource.git
   cd girlfriend-opensource
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the existing code style
   - Write clear commit messages
   - Add comments for complex logic
   - Test your changes thoroughly

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature: description of your changes"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Provide a clear title and description
   - Reference any related issues
   - Explain what changed and why

## 📋 Code Style Guidelines

### JavaScript

- Use ES6+ features (const/let, arrow functions, async/await)
- Use meaningful variable and function names
- Keep functions focused and small
- Add comments for non-obvious code
- Handle errors appropriately

### Example:
```javascript
// Good
const getUserFiles = async (userId) => {
  try {
    const files = await db.getFiles(userId);
    return files;
  } catch (error) {
    logger.error('Failed to get user files', { error: error.message });
    throw error;
  }
};

// Avoid
function f(u){return db.get(u)}
```

### HTML/CSS

- Use semantic HTML5 elements
- Keep CSS organized and commented
- Use meaningful class names
- Ensure responsive design
- Test on multiple browsers

## 🧪 Testing

Before submitting a PR:

1. **Test basic functionality**
   - Start the server
   - Test user login
   - Upload a photo and video
   - Test admin panel access
   - Verify rain animation works

2. **Test on different devices**
   - Desktop browsers (Chrome, Firefox, Safari)
   - Mobile browsers (iOS Safari, Chrome Android)
   - Different screen sizes

3. **Check for errors**
   - Look at browser console
   - Check server logs
   - Verify no breaking changes

## 📝 Commit Message Guidelines

Use clear, descriptive commit messages:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Examples:
```
feat: add video thumbnail generation
fix: resolve memory leak in rain animation
docs: update installation instructions
style: format admin panel CSS
refactor: simplify file upload logic
```

## 🎯 Areas for Contribution

Looking for ideas? Here are areas that need work:

### High Priority
- [ ] Environment variable support for passwords
- [ ] Persistent password storage
- [ ] Video thumbnail generation
- [ ] Bulk upload support
- [ ] User management system

### Medium Priority
- [ ] Dark mode toggle
- [ ] Custom rain animation speeds
- [ ] Album/folder organization
- [ ] Search functionality
- [ ] Export/backup feature

### Nice to Have
- [ ] Social sharing features
- [ ] Image filters and editing
- [ ] Slideshow mode
- [ ] Mobile app (React Native)
- [ ] Docker support

## 🐛 Known Issues to Fix

Check the [Issues](https://github.com/M4st3r-4ss/girlfriend-opensource/issues) page for current bugs and feature requests.

## 💬 Questions?

- Open a discussion on GitHub
- Check existing issues and PRs
- Review the documentation

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Every contribution helps make Memory Rain better for everyone. We appreciate your time and effort!
