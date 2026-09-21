
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";
import { Upload, Camera, MapPin, CheckCircle, Loader2, FileText, Image as ImageIcon, X, Sparkles, Wand2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { CATEGORY_LIST } from "@/constants/categories";
import { IssueService, normalizeIssueCategory } from "@backend/services/issues/issueService";
import { StorageService } from "@backend/services/storage/storageService";
import { analyzeMultipleImages, combineImageAnalyses } from "@/services/visionService";
import { checkForDuplicates, DuplicateDetectionResult } from "@/services/duplicateDetectionService";
import LocationPicker from "@/components/LocationPicker";
import DuplicateIssueModal from "@/components/DuplicateIssueModal";
import ImageUploadComponent from "@/components/ImageUploadComponent";

interface ImageFile {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
}

export default function ReportIssuePage() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([]);
  const [wards, setWards] = useState<{ id: string; name: string; municipality_id: string }[]>([]);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string>('');
  const [selectedWardId, setSelectedWardId] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ description: string; category: string } | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateDetectionResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [processedImageUrls, setProcessedImageUrls] = useState<string[]>([]);

  // Load municipalities and wards from database
  useEffect(() => {
    const fetchGeo = async () => {
      try {
        const { data: mData } = await supabase
          .from('municipalities')
          .select('id, name')
          .order('name');
        if (mData && mData.length > 0) {
          setMunicipalities(mData);
          const defaultMuni = userProfile?.municipality_id || mData[0].id;
          setSelectedMunicipalityId(defaultMuni);
        }

        const { data: wData } = await supabase
          .from('wards')
          .select('id, name, municipality_id')
          .order('name');
        if (wData && wData.length > 0) {
          setWards(wData);
          const defaultWard = userProfile?.ward_id || wData[0].id;
          setSelectedWardId(defaultWard);
        }
      } catch (err) {
        console.error('Error fetching municipalities/wards:', err);
      }
    };
    fetchGeo();
  }, [userProfile]);

  // Auto-fetch user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`),
      () => setLocation("Unable to detect location")
    );
  }, []);

  // Handle image change from ImageUploadComponent
  const handleImagesChange = (files: ImageFile[]) => {
    setImageFiles(files);
    
    // Extract image files for AI analysis only if Vision API key is set
    const imageFilesArray = files.map(f => f.file);
    if (imageFilesArray.length > 0 && import.meta.env.VITE_GOOGLE_VISION_API_KEY) {
      analyzePhotosWithAI(imageFilesArray);
    }
  };

  // Analyze photos with Google Vision AI
  const analyzePhotosWithAI = async (newFiles: File[]) => {
    if (!import.meta.env.VITE_GOOGLE_VISION_API_KEY && !import.meta.env.VITE_GEMINI_API_KEY) {
      toast({
        title: "AI Analysis Not Configured",
        description: "AI API key is not configured. Please enter the description manually.",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const analyses = await analyzeMultipleImages(newFiles);
      const combined = combineImageAnalyses(analyses);
      
      setAiSuggestion(combined);
      
      toast({
        title: "🤖 AI Analysis Complete",
        description: "Smart description and category suggestions generated!",
      });
    } catch (error) {
      console.error('AI analysis failed:', error);
      toast({
        title: "AI Analysis Failed",
        description: "Unable to analyze images automatically. Please add description manually.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply AI suggestions
  const applyAISuggestions = () => {
    if (aiSuggestion) {
      setDescription(aiSuggestion.description);
      setCategory(aiSuggestion.category);
      setAiSuggestion(null);
      
      toast({
        title: "AI Suggestions Applied",
        description: "Description and category have been updated with AI suggestions.",
      });
    }
  };

  // Handle location change with auto-jurisdiction detection
  const handleLocationChange = (newLocation: string, coords?: { lat: number; lng: number }) => {
    setLocation(newLocation);
    setCoordinates(coords || null);

    if (coords) {
      const isPrayagrajCoords =
        coords.lat >= 25.25 && coords.lat <= 25.65 && coords.lng >= 81.65 && coords.lng <= 82.05;
      const isPrayagrajAddr =
        newLocation.toLowerCase().includes('prayagraj') ||
        newLocation.toLowerCase().includes('allahabad');

      if (isPrayagrajCoords || isPrayagrajAddr) {
        const matched = municipalities.find(
          (m) =>
            m.name.toLowerCase().includes('prayagraj') ||
            m.name.toLowerCase().includes('allahabad')
        );
        if (matched) {
          setSelectedMunicipalityId(matched.id);
          const matchingWards = wards.filter((w) => w.municipality_id === matched.id);
          if (matchingWards.length > 0 && !selectedWardId) {
            setSelectedWardId(matchingWards[0].id);
          }
        }
      }
    }
  };

  // Compress and convert image file to base64 using HTML5 canvas
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 1200;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve((e.target?.result as string) || '');
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            resolve(compressed);
          } catch {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Convert images to compressed base64 strings
  const convertImagesToBase64 = async (files: File[]): Promise<string[]> => {
    const base64Images: string[] = [];
    const filesToProcess = files.slice(0, 3);
    
    for (const file of filesToProcess) {
      try {
        const base64 = await compressImage(file);
        if (base64) {
          base64Images.push(base64);
        }
      } catch (error) {
        console.error('Error compressing image:', error);
      }
    }

    return base64Images;
  };

  // Handle duplicate check and submission
  const handleSubmit = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to report an issue",
        variant: "destructive",
      });
      return;
    }

    // Basic validation
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please provide a description of the issue",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Category required",
        description: "Please select a category for the issue",
        variant: "destructive",
      });
      return;
    }

    if (!location.trim()) {
      toast({
        title: "Location required",
        description: "Please provide a location for the issue",
        variant: "destructive",
      });
      return;
    }

    // Step 1: Pre-process and compress images once
    setIsCheckingDuplicates(true);
    let preparedImageUrls: string[] = [];

    try {
      if (imageFiles.length > 0) {
        preparedImageUrls = await convertImagesToBase64(imageFiles.map(f => f.file));
      }
    } catch (err) {
      console.warn('Image processing warning:', err);
    }

    setProcessedImageUrls(preparedImageUrls);

    // Step 2: Check for duplicates with safety timeout race
    let duplicateCheckResult: DuplicateDetectionResult | null = null;
    try {
      const mappedCategory = normalizeIssueCategory(category);

      const checkPromise = checkForDuplicates(
        description,
        location,
        coordinates,
        preparedImageUrls[0],
        mappedCategory
      );

      const safetyTimeout = new Promise<DuplicateDetectionResult>((resolve) =>
        setTimeout(() => resolve({ isDuplicate: false, duplicates: [], confidence: 0 }), 2500)
      );

      duplicateCheckResult = await Promise.race([checkPromise, safetyTimeout]);
      setDuplicateResult(duplicateCheckResult);

      if (duplicateCheckResult.isDuplicate && duplicateCheckResult.confidence > 0.6) {
        setShowDuplicateModal(true);
        setIsCheckingDuplicates(false);
        return;
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
    } finally {
      // Guarantee duplicate checking state ends before submission
      setIsCheckingDuplicates(false);
    }

    // Step 3: No blocking duplicate -> proceed with submission
    await submitIssue(preparedImageUrls);
  };

  // Actual submission function
  const submitIssue = async (providedImageUrls?: string[]) => {
    setIsSubmitting(true);
    try {
      const safeCategory = normalizeIssueCategory(category);

      // Upload images using canonical StorageService with graceful base64 fallback
      let imageUrls: string[] = providedImageUrls || processedImageUrls;
      if (imageUrls.length === 0 && imageFiles.length > 0 && currentUser?.id) {
        try {
          imageUrls = await StorageService.uploadIssueImages(
            imageFiles.map(f => f.file),
            currentUser.id
          );
        } catch (storageErr) {
          console.warn('[ReportIssue] Storage upload unavailable, using base64 fallback:', storageErr);
          imageUrls = await convertImagesToBase64(imageFiles.map(f => f.file));
        }
      }

      // Extract coordinates - either from state or parse from location string
      let latitude = coordinates?.lat || null;
      let longitude = coordinates?.lng || null;

      if (!latitude && !longitude && location) {
        const coordsMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (coordsMatch) {
          latitude = parseFloat(coordsMatch[1]);
          longitude = parseFloat(coordsMatch[2]);
        }
      }

      // Submit issue via canonical IssueService (reporter_id & tracking_id managed by backend)
      const createdIssue = await IssueService.createIssue({
        description: description.trim(),
        category: safeCategory,
        address: location.trim(),
        municipality_id: selectedMunicipalityId || userProfile?.municipality_id || null,
        ward_id: selectedWardId || userProfile?.ward_id || null,
        latitude,
        longitude,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      });

      setSubmitted(true);
      toast({
        title: "Issue reported successfully!",
        description: `Your report #${createdIssue.tracking_id} has been submitted and will be reviewed.`,
      });

      // Reset form
      setDescription("");
      setCategory("");
      setLocation("");
      setCoordinates(null);
      setAiSuggestion(null);
      setImageFiles([]);
      setProcessedImageUrls([]);

      // Redirect to citizen dashboard after 1.5 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error("Error submitting issue:", error);
      
      let errorMessage = "An error occurred while submitting your report. Please try again.";
      if (error instanceof Error && error.message) {
        errorMessage = `Submission failed: ${error.message}`;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = `Submission failed: ${String((error as { message: unknown }).message)}`;
      }
      
      toast({
        title: "Failed to submit report",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsCheckingDuplicates(false);
    }
  };

  // Handle duplicate modal actions
  const handleProceedAnyway = async () => {
    setShowDuplicateModal(false);
    await submitIssue(processedImageUrls);
  };

  const handleCancelSubmission = () => {
    setShowDuplicateModal(false);
    setDuplicateResult(null);
    setProcessedImageUrls([]);
    toast({
      title: "Submission cancelled",
      description: "Your issue was not submitted. You can review the similar issues or modify your report.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-indigo-900 to-gray-900 text-white flex justify-center items-center p-6">
      <Card className="bg-white/10 border-none shadow-2xl w-full max-w-2xl p-6 rounded-3xl">
        <CardContent>
          <motion.h1
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-3xl font-bold text-center mb-6"
          >
            Report a Civic Issue
          </motion.h1>

          {/* Image Upload Section */}
          <div className="mb-6">
            <ImageUploadComponent
              onImagesChange={handleImagesChange}
              maxImages={5}
              maxFileSize={10}
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-300 font-medium">Description</label>
              {imageFiles.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => analyzePhotosWithAI(imageFiles.map(f => f.file))}
                  disabled={isAnalyzing}
                  className="text-blue-400 hover:text-blue-300 border-gray-600 hover:border-blue-400"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate Description
                    </>
                  )}
                </Button>
              )}
            </div>
            <Textarea
              placeholder="Describe the issue briefly or use AI to generate from photos"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-gray-800 text-white border-gray-700 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* AI Suggestions */}
          {aiSuggestion && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-600/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-blue-300">AI Smart Suggestions</span>
                  {isAnalyzing && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  )}
                </div>
                {aiSuggestion && (
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-300">Suggested Description:</span>
                      <p className="text-sm text-gray-400 bg-gray-800/50 p-2 rounded border border-gray-600">{aiSuggestion.description}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-300">Suggested Category:</span>
                      <p className="text-sm text-gray-400 bg-gray-800/50 p-2 rounded border border-gray-600">{aiSuggestion.category}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={applyAISuggestions}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      Apply Suggestions
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Category */}
          <div className="mb-6">
            <label className="block mb-2 text-gray-300 font-medium">Category</label>
            <Select value={category} onValueChange={(value) => setCategory(value)}>
              <SelectTrigger className="bg-gray-800 text-white border-gray-700">
                <SelectValue placeholder="Select issue category" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                {CATEGORY_LIST.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="mb-6">
            <label className="block mb-2 text-gray-300 font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location
            </label>
            <LocationPicker
              value={location}
              onChange={handleLocationChange}
              placeholder="Auto-detected or enter manually"
            />
          </div>

          {/* Municipal Jurisdiction Confirmation */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-800/60 p-4 rounded-xl border border-gray-700">
            <div>
              <label className="block mb-2 text-gray-300 font-medium text-sm">
                🏛️ Municipality Jurisdiction
              </label>
              <Select
                value={selectedMunicipalityId}
                onValueChange={(val) => {
                  setSelectedMunicipalityId(val);
                  const matching = wards.filter((w) => w.municipality_id === val);
                  if (matching.length > 0) {
                    setSelectedWardId(matching[0].id);
                  }
                }}
              >
                <SelectTrigger className="bg-gray-900 text-white border-gray-600">
                  <SelectValue placeholder="Select municipality" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 text-white border-gray-700">
                  {municipalities.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block mb-2 text-gray-300 font-medium text-sm">
                📍 Municipal Ward
              </label>
              <Select
                value={selectedWardId}
                onValueChange={(val) => setSelectedWardId(val)}
              >
                <SelectTrigger className="bg-gray-900 text-white border-gray-600">
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 text-white border-gray-700">
                  {wards
                    .filter((w) => !selectedMunicipalityId || w.municipality_id === selectedMunicipalityId)
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>




          {/* Submit Button */}
          <div className="text-center">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isCheckingDuplicates}
              className="bg-pink-600 hover:bg-pink-700 text-white px-8 py-3 text-lg rounded-full shadow-lg disabled:opacity-50"
            >
              {isCheckingDuplicates ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Checking for duplicates...
                </span>
              ) : isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </span>
              ) : (
                "Submit Report"
              )}
            </Button>
          </div>

          {/* Success Message */}
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-center flex flex-col items-center"
            >
              <CheckCircle className="w-10 h-10 text-green-400 mb-2" />
              <p className="text-green-300 font-medium">Report submitted successfully! You'll receive updates shortly.</p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Duplicate Issue Modal */}
      {duplicateResult && (
        <DuplicateIssueModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          duplicates={duplicateResult.duplicates}
          confidence={duplicateResult.confidence}
          onProceedAnyway={handleProceedAnyway}
          onCancel={handleCancelSubmission}
        />
      )}
    </div>
  );
}
