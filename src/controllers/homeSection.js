const HomeSection = require('../models/homeSection');
const fs = require('fs');
const path = require('path');

exports.createHomeSection = async (req, res) => {
  const { title, paragraphs, order } = req.body;
  let image = '';
  if (req.file){
    image = req.file.filename;
  }

  try {
    const homeSection = new HomeSection({
      title,
      paragraphs: JSON.parse(paragraphs),
      image,
      order
    });

    const newHomeSection = await homeSection.save();

    if (newHomeSection) {
      return res.status(201).json({ homeSection: newHomeSection });
    } else {
      return res.status(400).json({ message: 'Failed to create home section' });
    }
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'Something went wrong', error: error });
  }
}

exports.getHomeSections = async (req, res) => {
  try {
    const homeSections = await HomeSection.find({}).sort({order: 1});
    if (homeSections) {
      return res.status(200).json({ homeSections });
    } else {
      return res.status(404).json({ message: 'Home sections not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: 'Something went wrong', error: error });
  }
}

exports.updateHomeSection = async (req, res) => {
  const { id } = req.params;
  const { title, paragraphs, order, removeImage } = req.body;
  const homeSectionObj = { title, paragraphs: JSON.parse(paragraphs), order };
  if(req.file){
    homeSectionObj.image = req.file.filename;
  }

  try {
    // delete the old image if a new image is uploaded
    if (req.file || removeImage) {
      const homeSection = await HomeSection.findOne({
        _id: id
      });
      const oldImage = homeSection.image;
      if(oldImage) {
        const imagePath = path.join(path.dirname(__dirname), 'uploads', oldImage);
        fs.unlink(imagePath , (err  => {
          if (err) {
            console.error(err);
            return;
          }
          console.log('Image deleted successfully');
        }));
      }
    }

    if(removeImage) {
      homeSectionObj.image = '';
    }
    
    const updatedHomeSection = await HomeSection.findOneAndUpdate(
      { _id: id },
      homeSectionObj,
      { new: true }
    );
    

    if (updatedHomeSection) {
      res.status(200).json({ updatedHomeSection });
    } else {
      res.status(400).json({ message: 'Error updating home section' });
    }
  }
  catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Something went wrong', error: error });
  }
}

exports.deleteHomeSection = async (req, res) => {
  const { id } = req.params;

  try {
    const homeSection = await HomeSection.findOne({_id: id});
    if (!homeSection) {
      return res.status(404).json({ message: 'Home section not found' });
    }

    //delete the image from the uploads folder
    const imagePath = path.join(path.dirname(__dirname), 'uploads', homeSection.image);
    fs.unlink(imagePath , (err  => {
      if (err) {
        console.error(err);
        return;
      }
      console.log('Image deleted successfully');
    }
    ));

    const deletedHomeSection = await HomeSection.findByIdAndDelete(id);

    if (deletedHomeSection) {
      return res.status(200).json({ message: 'Home section deleted successfully', id: deletedHomeSection._id });
    }
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error: error });
  }
}