import { createClient, type SupabaseClient, type AuthChangeEvent, type Session, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type AuthListener = {
  data: { subscription: { unsubscribe: () => void } };
};

const createStubClient = (): SupabaseClient => {
  console.warn(
    "Supabase environment variables are not set. Running in guest-only mode."
  );

  const noop = async () => ({ data: { user: null, session: null }, error: null });

  return {
    auth: {
      getSession: async (): Promise<{ data: { session: Session | null }; error: null }> => ({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: (
        _event: AuthChangeEvent,
        _callback: (session: Session | null) => void,
      ): AuthListener => ({
        data: { subscription: { unsubscribe: () => void {} } },
      }),
      signInWithPassword: noop,
      signUp: noop,
      signOut: async () => ({ error: null }),
      getUser: async (): Promise<{ data: { user: User | null }; error: null }> => ({
        data: { user: null },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;
};

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createStubClient();
