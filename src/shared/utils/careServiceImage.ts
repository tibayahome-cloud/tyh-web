import { photoForService, serviceImageKey } from "../../domains/client/utils/serviceCatalog";
import nurseImg from "../../assets/images/service-nurse.png";
import elderlyImg from "../../assets/images/service-elderly.png";
import therapyImg from "../../assets/images/service-therapy.png";
import labImg from "../../assets/images/lab-sample-collection.png";
import doctorImg from "../../assets/images/service-doctor.png";
import ambulanceImg from "../../assets/images/service-ambulance.png";
import homeImg from "../../assets/images/hero-home.png";
import home2Img from "../../assets/images/hero.png";
import nurse2Img from "../../assets/images/service-nurse_.png";
import nurse3Img from "../../assets/images/nursing.png";
import physioImg from "../../assets/images/telemedicine/physiotherapy.webp";
import occupationalImg from "../../assets/images/telemedicine/generated/occupational-therapy-consultation.webp";
import speechImg from "../../assets/images/telemedicine/child-growth-review.webp";
import scanImg from "../../assets/images/telemedicine/imaging-review.webp";
import ecgImg from "../../assets/images/telemedicine/lab-results-review.webp";
import cancerImg from "../../assets/images/telemedicine/cancer-care.webp";
import maternityImg from "../../assets/images/telemedicine/maternity-care.webp";
import chronicImg from "../../assets/images/telemedicine/chronic-disease-care.webp";
import checkupImg from "../../assets/images/telemedicine/general-consultation.webp";
import equipmentImg from "../../assets/images/telemedicine/medication-review.webp";

const CARE_IMAGES = {
  nurse: nurseImg,
  "nurse-2": nurse2Img,
  "nurse-3": nurse3Img,
  elderly: elderlyImg,
  therapy: therapyImg,
  physio: physioImg,
  occupational: occupationalImg,
  speech: speechImg,
  lab: labImg,
  scan: scanImg,
  ecg: ecgImg,
  doctor: doctorImg,
  ambulance: ambulanceImg,
  home: homeImg,
  "home-2": home2Img,
  cancer: cancerImg,
  maternity: maternityImg,
  chronic: chronicImg,
  checkup: checkupImg,
  equipment: equipmentImg
} as const;

// Photos made for one service are dropped in src/assets/images/services/<service key>.webp (see the README there) and
// are used automatically; a service without one gets the closest stock photo.
const SERVICE_PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob("../../assets/images/services/*.{webp,jpg,jpeg,png}", { eager: true, import: "default" })).map(
    ([path, url]) => [path.split("/").pop()!.replace(/\.[^.]+$/, ""), url as string]
  )
);

/**
 * The picture for a home-based service, the same on every screen that shows one. A photo made for the service, named after
 * its key in `src/assets/images/services/` (see the README there), wins; otherwise the closest stock photo.
 */
export const careServiceImage = (service: { key: string; name: string; category?: { name: string } | null }): string =>
  photoForService(service.key, SERVICE_PHOTOS, CARE_IMAGES[serviceImageKey(service.name, service.category?.name)]);
