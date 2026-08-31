import { supabaseAdmin } from '@/lib/supabase/admin';

export {
  CLIENT_QURATOR_EVENTS,
  QURATOR_EVENT,
  trackClientEvent,
  type QuratorEventName,
} from '@/lib/qurator-events';

export async function trackQuratorEvent(
  eventName: string,
  userId: string | null,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('qurator_analytics').insert({
      event_name: eventName,
      user_id: userId,
      event_data: eventData,
    });
    if (error) console.error('qurator analytics insert:', error.message);
  } catch (err) {
    console.error('qurator analytics:', err);
  }
}

export async function trackQuratorEventOnce(
  eventName: string,
  userId: string,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  try {
    const sb = supabaseAdmin();
    const { count } = await sb
      .from('qurator_analytics')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', eventName)
      .eq('user_id', userId);
    if ((count ?? 0) > 0) return;
    await trackQuratorEvent(eventName, userId, eventData);
  } catch (err) {
    console.error('qurator analytics:', err);
  }
}
