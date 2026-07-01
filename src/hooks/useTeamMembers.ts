import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string | null;
  commercial_role?: string | null;
}

export const useTeamMembers = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      // Get current user's company
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) return;

      // Get all users in the same company
      const { data: companyUsers } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('company_id', userRole.company_id);

      if (!companyUsers) return;

      const userIds = companyUsers.map(u => u.user_id);

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role, commercial_role')
        .in('id', userIds);

      if (profiles) {
        setMembers(profiles);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOtherMembers = () => {
    return members.filter(m => m.id !== currentUserId);
  };

  return {
    members,
    loading,
    currentUserId,
    getOtherMembers,
    refresh: loadTeamMembers
  };
};
