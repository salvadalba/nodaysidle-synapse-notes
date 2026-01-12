-- Seed default user for unauthenticated access
INSERT INTO users (id, email, password_hash)
VALUES (
        '00000000-0000-0000-0000-000000000000',
        'default@synapse.notes',
        'no-password-needed'
    ) ON CONFLICT (id) DO NOTHING;