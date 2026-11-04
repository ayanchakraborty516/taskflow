import { z } from 'zod';

export const markNotificationReadValidator = {
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
};

export default {
  markNotificationReadValidator,
};

