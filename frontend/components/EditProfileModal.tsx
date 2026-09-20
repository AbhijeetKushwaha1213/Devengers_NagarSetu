import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Save } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';

// Form schema validation for real database columns
const formSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
});

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, onProfileUpdated }) => {
  const { currentUser, refreshUserProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      phone: '',
    },
  });

  // Load user data when modal opens
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser || !isOpen) return;
      
      setIsLoading(true);
      try {
        const { data: userProfile, error } = await supabase
          .from('user_profiles')
          .select('full_name, phone')
          .eq('id', currentUser.id)
          .single();
        
        if (userProfile && !error) {
          form.reset({
            fullName: userProfile.full_name || currentUser.full_name || '',
            phone: userProfile.phone || currentUser.phone || '',
          });
        } else {
          form.reset({
            fullName: currentUser.full_name || '',
            phone: currentUser.phone || '',
          });
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUserData();
  }, [currentUser, isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to update your profile",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Update only real user_profiles columns to prevent SQL column errors and privilege escalation
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: values.fullName,
          phone: values.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      // Update auth metadata if possible
      try {
        await supabase.auth.updateUser({
          data: { full_name: values.fullName }
        });
      } catch (authErr) {
        console.warn('Auth metadata update failed:', authErr);
      }

      await refreshUserProfile();

      toast({
        title: "Profile updated",
        description: "Your profile details have been saved.",
      });

      if (onProfileUpdated) {
        onProfileUpdated();
      }
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      const err = error as Error;
      toast({
        title: "Failed to update profile",
        description: err.message || "An error occurred while saving your profile.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your public civic profile information.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Rajesh Sharma" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Email Address
                </label>
                <Input 
                  value={currentUser?.email || ''} 
                  disabled 
                  className="bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed" 
                />
                <p className="text-xs text-muted-foreground mt-1">Managed securely through Supabase Auth</p>
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                <p><strong>Role:</strong> {currentUser?.role}</p>
                {currentUser?.municipality_name && <p><strong>Municipality:</strong> {currentUser.municipality_name}</p>}
                {currentUser?.ward_name && <p><strong>Ward:</strong> {currentUser.ward_name}</p>}
              </div>

              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileModal;
