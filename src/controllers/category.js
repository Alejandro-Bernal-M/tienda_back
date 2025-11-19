const Category = require('../models/category');
const slugify = require('slugify');
const fs = require('fs');
const path = require('path');

// Recursive function to create nested category list
function createCategories(categories, parentId = null) {
  let categoryList = [];
  let category;

  // If parentId is null, filter top-level categories
  if (parentId === null || parentId === undefined || parentId === '') {
    category = categories.filter(cat => cat.parentId == undefined || cat.parentId == '' || cat.parentId == null);
  } else {
    // Otherwise, filter categories with matching parentId
    category = categories.filter(cat => cat.parentId == parentId);
  }

  // Iterate over filtered categories
  category.forEach(cat => {
    // Push category details along with nested children categories recursively
    categoryList.push({
      _id: cat._id,
      name: cat.name,
      slug: cat.slug,
      categoryImage: cat.categoryImage,
      parentId: cat.parentId,
      children: createCategories(categories, cat._id) // Recursively call createCategories for children
    });
  });

  return categoryList;
}

// Controller function to create a new category
exports.createCategory = async (req, res) => {
  console.log('body', req.body)
  const categoryObj = {
    name: req.body.name,
    slug: slugify(req.body.name)
  };

  // If request contains a file, add its path to category object
  if (req.file) {
    categoryObj.categoryImage = req.file.filename;
  }

  // If parentId is provided in request body, add it to category object
  if (req.body.parentId) {
    categoryObj.parentId = req.body.parentId;
  } else {
    categoryObj.parentId = "";
  }

  const newCategory = new Category(categoryObj);

  try {
    const savedCategory = await newCategory.save();
    if (savedCategory === newCategory) {
      res.status(200).json({ savedCategory });
    } else {
      res.status(400).json({ message: 'Error saving category' });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Something went wrong', error: error });
  }
};

// Controller function to fetch all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    if (categories) {
      // Call createCategories function to create nested category list
      let categoryList = createCategories(categories);
      res.json({ categoryList });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Error fetching categories', error: error });
  }
};

// Controller function to update categories
exports.updateCategory = async (req, res) => {
  console.log('called updated category', req.body)
  const { _id, name, parentId } = req.body;
  const categoryObj = { name, parentId };
  if(req.file){
    categoryObj.categoryImage = req.file.filename;
  }

  try {
    // delete the old image if a new image is uploaded
    if (req.file) {
      const category = await Category.findOne({
        _id
      });
      const oldImage = category.categoryImage;
      const imagePath = path.join(path.dirname(__dirname), 'uploads', oldImage);
      fs.unlink(imagePath , (err  => {
        if (err) {
          console.error(err);
          return;
        }
        console.log('Image deleted successfully');
      }
      ));
    }
    
    const updatedCategory = await Category.findOneAndUpdate(
      { _id },
      categoryObj,
      { new: true }
    );
    

    if (updatedCategory) {
      res.status(200).json({ updatedCategory });
    } else {
      res.status(400).json({ message: 'Error updating category' });
    }
  }
  catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Something went wrong', error: error });
  }

};

// Controller function to delete categories

exports.deleteCategory = async (req, res) => {  
  const { id } = req.params;

  try {
    const category = await Category.findOne({_id: id});
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    //delete the image from the uploads folder
    const imagePath = path.join(path.dirname(__dirname), 'uploads', category.categoryImage);
    fs.unlink(imagePath , (err  => {
      if (err) {
        console.error(err);
        return;
      }
      console.log('Image deleted successfully');
    }
    ));

    // reassign the parentId of the child categories to be undefined
    const updatedCategories = await Category.updateMany(
      {
        parentId: id
      },
      {
        $set: {parentId: null}
      }
    );

    const deletedCategory = await Category.findOneAndDelete({ _id: id });
    const categories = await Category.find({});
    let categoryList = createCategories(categories);


    if (deletedCategory) {
      res.status(200).json({ message: 'Category deleted successfully', updatedCategories: categoryList});
    } else {
      res.status(400).json({ message: 'Error deleting category' });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Something went wrong', error: error });
  }
};