import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Check, Building2, MapPin } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';

// Form schema validation with real DB columns
const formSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
  municipalityId: z.string().optional(),
  wardId: z.string().optional(),
});

interface MunicipalityOption {
  id: string;
  name: string;
}

interface WardOption {
  id: string;
  name: string;
  municipality_id: string;
}

const UserOnboarding = () => {
  const { currentUser, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const [filteredWards, setFilteredWards] = useState<WardOption[]>([]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // Load municipalities and wards from database
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const { data: mData } = await supabase
          .from('municipalities')
          .select('id, name')
          .order('name');
        if (mData) setMunicipalities(mData);

        const { data: wData } = await supabase
          .from('wards')
          .select('id, name, municipality_id')
          .order('name');
        if (wData) setWards(wData);
      } catch (err) {
        console.error('Error fetching municipalities/wards:', err);
      }
    };
    fetchLocations();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: currentUser?.user_metadata?.full_name || '',
      phone: '',
      municipalityId: '',
      wardId: '',
    },
  });

  const selectedMunicipality = form.watch('municipalityId');

  useEffect(() => {
    if (selectedMunicipality) {
      setFilteredWards(wards.filter(w => w.municipality_id === selectedMunicipality));
    } else {
      setFilteredWards(wards);
    }
  }, [selectedMunicipality, wards]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to complete your profile",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upsert user profile using only verified database columns
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: currentUser.id,
          full_name: values.fullName,
          phone: values.phone || null,
          role: 'citizen',
          municipality_id: values.municipalityId || null,
          ward_id: values.wardId || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;

      await refreshProfile();

      toast({
        title: "Profile created",
        description: "Welcome to Nagar Setu!",
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error("Error creating profile:", error);
      const err = error as Error;
      toast({
        title: "Failed to create profile",
        description: err.message || "An error occurred while creating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold mb-2">Complete Your Citizen Profile</h1>
          <p className="text-muted-foreground">
            Set up your civic profile to report and track municipal issues in your area.
          </p>
        </div>
        
        <div className="bg-card rounded-xl shadow-subtle p-6 md:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., +91 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {municipalities.length > 0 && (
                <FormField
                  control={form.control}
                  name="municipalityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        Municipality
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your municipality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {municipalities.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {filteredWards.length > 0 && (
                <FormField
                  control={form.control}
                  name="wardId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        Ward
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your ward" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredWards.map(w => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <div className="pt-4 flex justify-end">
                <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving Profile...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="h-4 w-4" />
                      Complete Profile & Go to Dashboard
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default UserOnboarding;
