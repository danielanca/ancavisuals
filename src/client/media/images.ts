// Import images using ES6 import syntax
import logo from './assets/most-wanted/DEPARTAMENTUL_Batch.png';
import roFlag from './assets/most-wanted/romania_flag.jpg';
import enFlag from './assets/most-wanted/united-kingdom_flag.webp';
import suspect1 from './assets/suspects/Profile Image 1.png';
import suspect2 from './assets/suspects/Profile Image 2.png';
import suspect3 from './assets/suspects/Profile Image 3.png';
import suspect4 from './assets/suspects/Profile Image 4.png';
import suspect5 from './assets/suspects/Profile Image 5.png';
import f1 from './assets/most-wanted/fingerprints/fp1.jpg';
import f2 from './assets/most-wanted/fingerprints/fp2.jpg';
import f3 from './assets/most-wanted/fingerprints/fp3.jpg';
import f4 from './assets/most-wanted/fingerprints/fp1.jpg';
import f5 from './assets/most-wanted/fingerprints/fp2.jpg';
import ImgAvatar from './assets/facebook-chat/default.jpg';
import facebookLogo from './assets/facebook-chat/facebook-logo.png';
import imgChatNone from './assets/facebook-chat/imgChatNone.jpg';

// Structure the images object
const images = {
  mostwanted: {
    logo: logo,
    lang: {
      ro: roFlag,
      en: enFlag,
    },
    mock_suspects: {
      suspect1: { profilePicture:suspect1, fingerprint: f1},
      suspect2: { profilePicture:suspect2, fingerprint: f2},
      suspect3: { profilePicture:suspect3, fingerprint: f3},
      suspect4: { profilePicture:suspect4, fingerprint: f4},
      suspect5: { profilePicture:suspect5, fingerprint: f5},
    },
  },
  facebook_chat: {
    ImgAvatar: ImgAvatar,
    facebookLogo: facebookLogo,
    imgChatNone: imgChatNone,
  },
};

export default images;
