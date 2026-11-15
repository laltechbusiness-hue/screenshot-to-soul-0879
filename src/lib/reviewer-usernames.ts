import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type UsernameSchema = {
  public: Database["public"] & {
    Tables: {
      reviewer_usernames: {
        Row: { user_id: string; username: string };
        Insert: { user_id: string; username: string };
        Update: { username?: string };
        Relationships: [];
      };
    };
    Functions: {
      my_profile_review_ids: { Args: { _offset: number }; Returns: { review_id: string }[] };
      set_reviewer_username: { Args: { _username: string }; Returns: string };
      review_usernames: {
        Args: { _review_ids: string[] };
        Returns: { review_id: string; username: string }[];
      };
    };
  };
};

export function withReviewerUsernames(client: SupabaseClient<Database>) {
  return client as unknown as SupabaseClient<UsernameSchema>;
}
