
-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by TEXT,
    title TEXT,
    class_id UUID REFERENCES public.classes(id)
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow all users to read notifications'
    ) THEN
        CREATE POLICY "Allow all users to read notifications" ON public.notifications
        FOR SELECT TO public USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow all to insert notifications'
    ) THEN
        CREATE POLICY "Allow all to insert notifications" ON public.notifications
        FOR INSERT TO public WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow all to update notifications'
    ) THEN
        CREATE POLICY "Allow all to update notifications" ON public.notifications
        FOR UPDATE TO public USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow all to delete notifications'
    ) THEN
        CREATE POLICY "Allow all to delete notifications" ON public.notifications
        FOR DELETE TO public USING (true);
    END IF;
END $$;
