import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Image as ImageIcon, AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface ImageFile {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
}

interface ImageUploadComponentProps {
  onImagesChange: (files: ImageFile[]) => void;
  maxImages?: number;
  maxFileSize?: number; // in MB
}

const ImageUploadComponent: React.FC<ImageUploadComponentProps> = ({
  onImagesChange,
  maxImages = 5,
  maxFileSize = 10 // 10MB default for images
}) => {
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File size validation
  const validateFileSize = (file: File): boolean => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      toast({
        title: "File too large",
        description: `Image size must be less than ${maxFileSize}MB. Current size: ${fileSizeMB.toFixed(1)}MB`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Validate file type
  const validateFileType = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload only image files (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Add image file
  const addImageFile = (file: File) => {
    if (!validateFileType(file)) return;
    if (!validateFileSize(file)) return;

    if (imageFiles.length >= maxImages) {
      toast({
        title: "Upload limit reached",
        description: `Maximum ${maxImages} images allowed`,
        variant: "destructive",
      });
      return;
    }

    const imageFile: ImageFile = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    };

    const updatedFiles = [...imageFiles, imageFile];
    setImageFiles(updatedFiles);
    onImagesChange(updatedFiles);

    toast({
      title: "Image added",
      description: "Image uploaded successfully",
    });
  };

  // Remove image file
  const removeImageFile = (id: string) => {
    const updatedFiles = imageFiles.filter(file => {
      if (file.id === id) {
        URL.revokeObjectURL(file.url);
        return false;
      }
      return true;
    });
    
    setImageFiles(updatedFiles);
    onImagesChange(updatedFiles);

    toast({
      title: "Image removed",
      description: "Image removed successfully",
    });
  };

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const remainingSlots = maxImages - imageFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast({
        title: "Upload limit",
        description: `You can only upload ${remainingSlots} more image(s). Maximum ${maxImages} images allowed.`,
        variant: "destructive",
      });
    }

    filesToAdd.forEach(file => addImageFile(file));
    event.target.value = '';
  };

  // Clear all images
  const clearAllImages = () => {
    imageFiles.forEach(file => URL.revokeObjectURL(file.url));
    setImageFiles([]);
    onImagesChange([]);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Upload Control */}
      <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
        <CardContent className="p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <ImageIcon className="w-8 h-8 text-blue-600" />
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Upload Issue Photos</h3>
              <p className="text-sm text-gray-500 mb-4">
                {imageFiles.length}/{maxImages} images uploaded
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageFiles.length >= maxImages}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Choose Files
              </Button>
              
              <label className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  disabled={imageFiles.length >= maxImages}
                  className="flex items-center gap-2 w-full"
                  asChild
                >
                  <span>
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={imageFiles.length >= maxImages}
                />
              </label>
            </div>

            <p className="text-xs text-gray-400">
              Supported formats: JPG, PNG, GIF, WebP (max {maxFileSize}MB each)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Image Preview Grid */}
      {imageFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Uploaded Images</h3>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAllImages}
                className="text-red-600 hover:text-red-700"
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence>
              {imageFiles.map((imageFile, index) => (
                <motion.div
                  key={imageFile.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="relative group"
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      {/* Image Preview */}
                      <div className="relative aspect-square">
                        <img
                          src={imageFile.url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Delete Button */}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeImageFile(imageFile.id)}
                          className="absolute top-2 right-2 w-8 h-8 p-0 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </Button>

                        {/* Image Number Badge */}
                        <Badge 
                          className="absolute top-2 left-2"
                          variant="default"
                        >
                          {index + 1}
                        </Badge>
                      </div>

                      {/* File Info */}
                      <div className="p-2 bg-gray-50">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {imageFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(imageFile.size)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Info Message */}
      {imageFiles.length === 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">Add Photos to Your Report</h4>
                <p className="text-sm text-blue-700 mb-2">
                  Upload clear photos of the issue to help authorities understand and resolve the problem faster.
                </p>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• Take photos from multiple angles</li>
                  <li>• Ensure good lighting for clarity</li>
                  <li>• Include surrounding context</li>
                  <li>• Maximum {maxImages} images, {maxFileSize}MB each</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImageUploadComponent;
