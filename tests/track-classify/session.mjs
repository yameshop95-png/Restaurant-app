// Test hàm phân loại của bộ theo dõi website (src/site/trackClassify.js):
//   - classifySource: referrer + utm_source → 6 nhóm google / facebook / instagram /
//     zalo / direct / other. utm_source được ưu tiên hơn referrer (quảng cáo có gắn thẻ).
//   - classifyDevice: userAgent → mobile / tablet / desktop.
// Chạy qua run.mjs (npm run test:classify).
import { classifyDevice, classifySource } from '../../src/site/trackClassify.js';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  console.log(`${ok ? 'ok' : 'FAIL'} - ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (mong đợi ${JSON.stringify(expected)})`}`);
  if (!ok) failures += 1;
};

// ---------- classifySource: theo referrer ----------
check('referrer google.com', classifySource({ referrer: 'https://www.google.com/' }), 'google');
check('referrer google.com.au', classifySource({ referrer: 'https://www.google.com.au/search?q=pho' }), 'google');
check('referrer facebook', classifySource({ referrer: 'https://www.facebook.com/' }), 'facebook');
check('referrer l.facebook.com (bọc link)', classifySource({ referrer: 'https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com' }), 'facebook');
check('referrer lm.facebook.com', classifySource({ referrer: 'https://lm.facebook.com/' }), 'facebook');
check('referrer m.facebook.com', classifySource({ referrer: 'https://m.facebook.com/story.php' }), 'facebook');
check('referrer instagram', classifySource({ referrer: 'https://www.instagram.com/' }), 'instagram');
check('referrer l.instagram.com', classifySource({ referrer: 'https://l.instagram.com/?u=https%3A%2F%2Fexample.com' }), 'instagram');
check('referrer chat.zalo.me', classifySource({ referrer: 'https://chat.zalo.me/' }), 'zalo');
check('referrer zalo.me', classifySource({ referrer: 'https://zalo.me/0901234567' }), 'zalo');
check('referrer bing → other', classifySource({ referrer: 'https://www.bing.com/search?q=pho' }), 'other');
check('referrer duckduckgo → other', classifySource({ referrer: 'https://duckduckgo.com/?q=pho' }), 'other');
check('referrer trang lạ → other', classifySource({ referrer: 'https://blog.example.com/bai-viet' }), 'other');
check('referrer rỗng → direct', classifySource({ referrer: '' }), 'direct');
check('không có referrer → direct', classifySource({}), 'direct');
check('referrer null → direct', classifySource({ referrer: null }), 'direct');
check('referrer không phải URL → other', classifySource({ referrer: 'android-app://com.google.android.gm' }), 'other');

// ---------- classifySource: utm_source được ưu tiên ----------
check('utm facebook thắng referrer google', classifySource({ referrer: 'https://www.google.com/', utmSource: 'facebook' }), 'facebook');
check('utm fb → facebook', classifySource({ utmSource: 'fb' }), 'facebook');
check('utm Facebook (hoa thường) → facebook', classifySource({ utmSource: 'Facebook' }), 'facebook');
check('utm fb_ads → facebook', classifySource({ utmSource: 'fb_ads' }), 'facebook');
check('utm ig → instagram', classifySource({ utmSource: 'ig' }), 'instagram');
check('utm instagram → instagram', classifySource({ utmSource: 'instagram' }), 'instagram');
check('utm google → google', classifySource({ utmSource: 'google' }), 'google');
check('utm googleads → google', classifySource({ utmSource: 'GoogleAds' }), 'google');
check('utm zalo → zalo', classifySource({ utmSource: 'zalo' }), 'zalo');
check('utm zalo_oa → zalo', classifySource({ utmSource: 'zalo_oa' }), 'zalo');
check('utm newsletter → other', classifySource({ utmSource: 'newsletter' }), 'other');
check('utm lạ → other (dù referrer trống)', classifySource({ utmSource: 'tiktok' }), 'other');
check('utm rỗng thì quay về referrer', classifySource({ referrer: 'https://www.google.com/', utmSource: '  ' }), 'google');
check('utm rỗng + referrer rỗng → direct', classifySource({ utmSource: '' }), 'direct');

// ---------- classifyDevice ----------
const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  ipad:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
};
check('iPhone → mobile', classifyDevice(UA.iphone), 'mobile');
check('Android có Mobile → mobile', classifyDevice(UA.androidPhone), 'mobile');
check('iPad → tablet', classifyDevice(UA.ipad), 'tablet');
check('Android không Mobile → tablet', classifyDevice(UA.androidTablet), 'tablet');
check('Windows → desktop', classifyDevice(UA.windows), 'desktop');
check('Mac → desktop', classifyDevice(UA.mac), 'desktop');
check('UA rỗng → desktop', classifyDevice(''), 'desktop');
check('UA null → desktop', classifyDevice(null), 'desktop');

console.log(failures === 0 ? '\nTẤT CẢ TEST ĐẠT' : `\nCÓ ${failures} TEST THẤT BẠI`);
process.exit(failures === 0 ? 0 : 1);
