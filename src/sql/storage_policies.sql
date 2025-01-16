-- Política para permitir todas as operações no bucket 'audios'
CREATE POLICY "Permitir todas as operações no bucket audios" ON storage.objects
FOR ALL
USING (bucket_id = 'audios')
WITH CHECK (bucket_id = 'audios');

-- Habilitar RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 