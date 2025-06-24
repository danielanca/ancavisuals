import React from 'react';

type FeaturedImage = {
  src: string;
  alt: string;
  colSpan: string; // e.g. "col-span-2"
  aspect: string; // e.g. "aspect-[2/1]"
};

const featuredImages: FeaturedImage[] = [
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FPoze-125.jpg?alt=media&token=364b1285-b470-4251-8002-8ba6a7a1bb98',
    alt: 'Intimate wedding moment captured on film',
    colSpan: 'col-span-2',
    aspect: 'aspect-[4/3]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FTite-Ema-57.jpg?alt=media&token=f4acd14b-dc0a-47fb-94af-d4c39a40b7eb',
    alt: 'Golden hour engagement session',
    colSpan: 'col-span-1',
    aspect: 'aspect-[3/4]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FTite-Ema-71.jpg?alt=media&token=5f019712-7f12-4f07-889b-2dcdc811884c',
    alt: 'Artistic bridal portrait on film',
    colSpan: 'col-span-1',
    aspect: 'aspect-[3/4]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FClaudiu-016.jpg?alt=media&token=151a9324-2424-476b-8163-9b6610611f12',
    alt: 'Candid family moment',
    colSpan: 'col-span-2',
    aspect: 'aspect-[2/1]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FClaudiu-039.jpg?alt=media&token=c8a8ad7e-cdfd-4a30-88ac-e47c15366d00',
    alt: 'Wedding ceremony in natural light',
    colSpan: 'col-span-2',
    aspect: 'aspect-[2/1]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FClaudiu-049.jpg?alt=media&token=8a29da51-1c7a-4f76-830c-b66379d19bf9',
    alt: 'Romantic couple portrait',
    colSpan: 'col-span-1',
    aspect: 'aspect-[1.5/1]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FClaudiu-044.jpg?alt=media&token=6677e359-8f8d-4204-b5ed-b8ef1675b9b6',
    alt: 'Editorial fashion on film',
    colSpan: 'col-span-1',
    aspect: 'aspect-[1.5/1]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FVertical-218mm.jpg?alt=media&token=08420520-11dc-4d9e-86eb-8ee371d4bd37',
    alt: 'Wedding details and styling',
    colSpan: 'col-span-2',
    aspect: 'aspect-[5/3]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FVertical-225.jpg?alt=media&token=bc2c762a-569a-4858-bfd6-5c46a34428ed',
    alt: 'Lifestyle portrait session',
    colSpan: 'col-span-2',
    aspect: 'aspect-[2/3]',
  },
  {
    src: 'https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FVertical-165.jpg?alt=media&token=25089c20-3822-415e-a3fa-75e602af5c61',
    alt: 'Destination wedding landscape',
    colSpan: 'col-span-2 lg:col-span-4',
    aspect: 'aspect-[2/1]',
  },
];

const Featured = () => {
  return (
    <section className='py-32 px-6'>
      <div className='max-w-7xl mx-auto'>
        <div className='text-center mb-20'>
          <h2 className='text-3xl md:text-4xl font-light tracking-[0.1em] mb-6 uppercase'>ULTIMELE EVENIMENTE</h2>
          <p className='text-gray-400 max-w-2xl mx-auto leading-relaxed'>
            Fiecare cadru spune o poveste despre iubire, conexiune și frumoasa imperfecțiune de a fi om.
          </p>
        </div>

        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {featuredImages.map((image, index) => (
            <div key={index} className={`${image.colSpan} ${image.aspect} group cursor-pointer`}>
              <img
                src={image.src}
                alt={image.alt}
                className='w-full h-full object-cover rounded-sm transition-transform duration-500 group-hover:scale-105'
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Featured;
