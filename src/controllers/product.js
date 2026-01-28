const User = require('../models/user');
const Product = require('../models/product');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({}).populate({
      path: 'createdBy',
      select: 'firstName lastName fullName' // Include the virtual fullName
    }).populate({
      path: 'category',
      select: 'name _id'
    });
    
    if(!products) {
      return res.status(404).json({message: 'Error getting the products.'})
    }
    
    res.status(200).json({products})
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.createProduct = async (req, res) => {
  console.log('body', req.body)
  if (req.body === null || req.body === undefined || req.body.size === 0) {
    return res.status(400).json({ message: 'Please fill all required fields' });
  }
  const { name, price, quantity, description, category, offer, sizes, colors } = req.body;
  let productImages = [];

  if (req.files && req.files.length > 0) {
    productImages = req.files.map((file) => ({ img: file.filename }));
  }

  const processedSizes = sizes ? sizes.split(',').map(size => size.trim().toUpperCase()) : [];
  const processedColors = colors ? colors.split(',').map(color => color.trim().toUpperCase()) : [];

  const product = new Product({
    name,
    slug: slugify(name),
    price,
    quantity,
    description,
    category,
    productImages,
    offer,
    sizes: processedSizes,
    colors: processedColors,
    createdBy: req.user._id,
  });

  try {
    const savedProduct = await product.save();
    const savedProductWithPopulations = await Product.findById(savedProduct._id)
    .populate({
      path: 'createdBy',
      select: 'firstName lastName fullName'
    })
    .populate({
      path: 'category',
      select: 'name _id'
    })
    .exec();

    if (!savedProductWithPopulations) {
      return res.status(404).json({ message: 'Product not found after save' });
    }
    res.status(200).json({ savedProduct: savedProductWithPopulations });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
};

exports.getSpecificProducts = async (req, res) => {
  try {
    const product = await Product.findOne({_id: req.params.productId}).populate({
      path: 'createdBy',
      select: 'firstName lastName fullName' // Include the virtual fullName
    }).populate({
      path: 'category',
      select: 'name _id'
    }).exec();
    if(!product) {
      return res.status(404).json({ message: 'Error getting the product.' })
    }

    res.status(200).json({product})
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.deleteProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findOne({ _id: productId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const images = product.productImages;
    if (images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const imagePath = path.join(path.dirname(__dirname), 'uploads', image.img);
        fs.unlink(imagePath, (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Something went wrong', error: err });
          }
        }
        );
      }
    }

    const productDeleted = await Product.findOneAndDelete({ _id: productId });
    
    if (!productDeleted) {
      return res.status(400).json({ message: 'Error deleting product' });
    }
    return res.status(200).json({ message: 'Product successfully deleted', product: productDeleted });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
};

exports.updateProduct = async (req, res) => {
  const { name, price, quantity, description, category, reviews, offer, sizes, colors, imagesToDeleteIds, imagesToDelete } = req.body;
  let productImages = [];
  if (req.files && req.files.length > 0) {
    productImages = req.files.map((file) => ({ img: file.filename }));
  }

  const processedSizes = sizes ? sizes.split(',').map(size => size.trim().toUpperCase()) : [];
  const processedColors = colors ? colors.split(',').map(color => color.trim().toUpperCase()) : [];

  const updatedFields = {
    name,
    price,
    quantity,
    description,
    category,
    productImages,
    updatedAt: Date.now(),
    reviews,
    offer,
    sizes: processedSizes,
    colors: processedColors
  };

  try {
    const product = await Product.findOne({ _id: req.body.productId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    let filteredImages = [];

    if(imagesToDeleteIds.length > 0) {
      filteredImages = product.productImages.filter((image) => !imagesToDeleteIds.includes(image._id));
    }else {
      filteredImages = product.productImages
    }
    
    let imagesToDeleteParsed = JSON.parse(imagesToDelete);

    if (imagesToDeleteParsed.length > 0) {
      for (let i = 0; i < imagesToDeleteParsed.length; i++) {
        const image = imagesToDeleteParsed[i];
        const imagePath = path.join(path.dirname(__dirname), 'uploads', image.img);
        fs.unlink(imagePath, (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Something went wrong', error: err });
          }
        });
      }
    }

    updatedFields.productImages = [...filteredImages, ...productImages];

    const updateProduct = await Product.findOneAndUpdate({ _id: req.body.productId }, updatedFields, { new: true }).populate({
      path: 'createdBy',
      select: 'firstName lastName fullName' // Include the virtual fullName
      }).populate({
        path: 'category',
        select: 'name _id'
      }).exec();;

    if (!updateProduct) {
      return res.status(400).json({ message: 'Error updating product' });
    }

    return res.status(200).json({ message: 'Product successfully updated', product: updateProduct });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
};

exports.addReviewToProduct = async (req, res) => {
  const { review, projectId } = req.body;
  const reviewId = uuidv4();

  review.id = reviewId;

  try {
    const project = await Project.findOne({ id: projectId });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    project.reviews.push(review);
    const savedProject = await project.save();

    if (!savedProject) {
      return res.status(400).json({ message: 'Error adding review' });
    }
    return res.status(200).json({ message: 'Review successfully added', project: savedProject });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
};
