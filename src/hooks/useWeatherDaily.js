import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addIsoDays } from '../lib/weather';

// Đọc thời tiết của một tuần (thứ Hai → Chủ nhật). Bảng chưa có, mất mạng, hoặc bị từ chối
// thì trả null — ô dự báo giữ nguyên như khi chưa có thời tiết. Không ghi, không gọi API ngoài.
export function useWeatherDaily(weekStart) {
  const [days, setDays] = useState(undefined);

  useEffect(() => {
    if (!weekStart) return undefined;
    let alive = true;
    const end = addIsoDays(weekStart, 6);

    const load = () => {
      supabase
        .from('weather_daily')
        .select('date,temp_max,temp_min,precipitation_mm,weather_code,condition,source')
        .gte('date', weekStart)
        .lte('date', end)
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) {
            setDays((prev) => (Array.isArray(prev) ? prev : null));
            return;
          }
          setDays(data ?? []);
        })
        .catch(() => {
          if (alive) setDays((prev) => (Array.isArray(prev) ? prev : null));
        });
    };

    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [weekStart]);

  return days;
}
