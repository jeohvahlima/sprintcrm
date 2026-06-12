import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TrainingScope = 'global' | 'company';
export type VideoType = 'youtube' | 'upload';
export type TrainingTrack = 'onboarding' | 'sdr' | 'closer' | 'gestao' | 'plataforma';

export interface TrainingModule {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  icon: string;
  order_index: number;
  is_active: boolean;
  scope: TrainingScope;
  track: TrainingTrack;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lessons?: TrainingLesson[];
  lessonsCount?: number;
  completedCount?: number;
}

export interface TrainingLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  youtube_video_id: string | null;
  video_url: string | null;
  video_type: VideoType;
  duration_minutes: number | null;
  order_index: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed?: boolean;
}

export interface TrainingProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  company_id: string;
  watched_at: string;
  completed: boolean;
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function useTraining() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchModules = async () => {
    try {
      setLoading(true);
      
      // Get company ID
      const { data: cid } = await supabase.rpc('get_my_company_id');
      if (!cid) {
        setModules([]);
        return;
      }
      setCompanyId(cid);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Detect master account context
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, is_master_account, parent_company_id')
        .eq('id', cid)
        .single();
      
      // Master company id (used to fetch GLOBAL trainings produced by Grow Sales Inteligência)
      const masterCompanyId = companyData?.is_master_account
        ? cid
        : (companyData?.parent_company_id || cid);
      
      // Fetch modules:
      //  - GLOBAL modules from the master account (visible to all subaccounts)
      //  - COMPANY modules owned by the user's own company (custom recordings for this team)
      const { data: modulesData, error: modulesError } = await supabase
        .from('training_modules')
        .select('*')
        .eq('is_active', true)
        .or(`and(company_id.eq.${masterCompanyId},scope.eq.global),and(company_id.eq.${cid},scope.eq.company)`)
        .order('order_index', { ascending: true });
      
      if (modulesError) throw modulesError;
      
      // Fetch lessons for each module
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('training_lessons')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      
      if (lessonsError) throw lessonsError;
      
      // Fetch progress for current user
      let progressData: TrainingProgress[] = [];
      if (user) {
        const { data: progress } = await supabase
          .from('training_progress')
          .select('*')
          .eq('user_id', user.id);
        
        progressData = (progress || []) as TrainingProgress[];
      }
      
      // Combine data
      const modulesWithLessons = (modulesData || []).map((module: TrainingModule) => {
        const moduleLessons = (lessonsData || []).filter(
          (lesson: TrainingLesson) => lesson.module_id === module.id
        ).map((lesson: TrainingLesson) => ({
          ...lesson,
          completed: progressData.some(
            p => p.lesson_id === lesson.id && p.completed
          )
        }));
        
        return {
          ...module,
          lessons: moduleLessons,
          lessonsCount: moduleLessons.length,
          completedCount: moduleLessons.filter((l: TrainingLesson) => l.completed).length
        };
      });
      
      setModules(modulesWithLessons);
    } catch (error) {
      console.error('Error fetching training modules:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os módulos de treinamento'
      });
    } finally {
      setLoading(false);
    }
  };

  const createModule = async (data: { title: string; description?: string; icon?: string; scope?: TrainingScope }) => {
    try {
      if (!companyId) throw new Error('Company ID not found');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const maxOrder = modules.length > 0 
        ? Math.max(...modules.map(m => m.order_index)) + 1 
        : 0;
      
      const { error } = await supabase
        .from('training_modules')
        .insert({
          company_id: companyId,
          title: data.title,
          description: data.description || null,
          icon: data.icon || 'book',
          order_index: maxOrder,
          scope: data.scope || 'company',
          created_by: user?.id
        } as any);
      
      if (error) throw error;
      
      toast({ title: 'Sucesso', description: 'Módulo criado com sucesso' });
      await fetchModules();
    } catch (error) {
      console.error('Error creating module:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar o módulo' });
    }
  };

  const updateModule = async (id: string, data: { title?: string; description?: string; icon?: string }) => {
    try {
      const { error } = await supabase
        .from('training_modules')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Módulo atualizado com sucesso'
      });
      
      await fetchModules();
    } catch (error) {
      console.error('Error updating module:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o módulo'
      });
    }
  };

  const deleteModule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('training_modules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Módulo excluído com sucesso'
      });
      
      await fetchModules();
    } catch (error) {
      console.error('Error deleting module:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o módulo'
      });
    }
  };

  const createLesson = async (moduleId: string, data: { 
    title: string; 
    description?: string; 
    youtube_url?: string;
    video_url?: string;
    video_type?: VideoType;
    duration_minutes?: number;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const moduleData = modules.find(m => m.id === moduleId);
      const maxOrder = moduleData?.lessons?.length 
        ? Math.max(...moduleData.lessons.map(l => l.order_index)) + 1 
        : 0;
      
      const videoType: VideoType = data.video_type || 'youtube';
      const youtubeUrl = videoType === 'youtube' ? (data.youtube_url || '') : null;
      const videoId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;
      
      const { error } = await supabase
        .from('training_lessons')
        .insert({
          module_id: moduleId,
          title: data.title,
          description: data.description || null,
          youtube_url: youtubeUrl,
          youtube_video_id: videoId,
          video_url: videoType === 'upload' ? (data.video_url || null) : null,
          video_type: videoType,
          duration_minutes: data.duration_minutes || null,
          order_index: maxOrder,
          created_by: user?.id
        } as any);
      
      if (error) throw error;
      
      toast({ title: 'Sucesso', description: 'Aula adicionada com sucesso' });
      await fetchModules();
    } catch (error) {
      console.error('Error creating lesson:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível adicionar a aula' });
    }
  };

  const updateLesson = async (id: string, data: { 
    title?: string; 
    description?: string; 
    youtube_url?: string;
    duration_minutes?: number;
  }) => {
    try {
      const updateData: any = { ...data };
      if (data.youtube_url) {
        updateData.youtube_video_id = extractYouTubeId(data.youtube_url);
      }
      
      const { error } = await supabase
        .from('training_lessons')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Aula atualizada com sucesso'
      });
      
      await fetchModules();
    } catch (error) {
      console.error('Error updating lesson:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a aula'
      });
    }
  };

  const deleteLesson = async (id: string) => {
    try {
      const { error } = await supabase
        .from('training_lessons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Sucesso',
        description: 'Aula excluída com sucesso'
      });
      
      await fetchModules();
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir a aula'
      });
    }
  };

  const markLessonAsCompleted = async (lessonId: string) => {
    try {
      if (!companyId) throw new Error('Company ID not found');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      
      const { error } = await supabase
        .from('training_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          company_id: companyId,
          completed: true,
          watched_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,lesson_id'
        });
      
      if (error) throw error;
      
      await fetchModules();
    } catch (error) {
      console.error('Error marking lesson as completed:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível marcar a aula como concluída'
      });
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  return {
    modules,
    loading,
    companyId,
    createModule,
    updateModule,
    deleteModule,
    createLesson,
    updateLesson,
    deleteLesson,
    markLessonAsCompleted,
    refetch: fetchModules
  };
}
