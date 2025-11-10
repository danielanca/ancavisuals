// src/booking/steps/Step4Details.tsx
import React from 'react';
import LocationField from '../../LocationField';
import type { PlaceLite, PkgInfo } from '../types';
import { pad2, parseTimeToMinutes } from '../utils/time';
import PackageTiles from '../components/PackageTiles';
import styles from '../components/CustomOptions.module.scss';

const fmtRON = (n: number) => n.toLocaleString('ro-RO');


export default function Step4Details({
  MAPS_KEY,
  location,
  setLocation,
  placeId,
  setPlaceId,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  errors,
  packagesNormalized,
  selectedPackages,
  setSelectedPackages,
  showCustom,
  setShowCustom,
  photo,
  setPhoto,
  video,
  setVideo,
  totalPrice,
  submitBooking,
  goBack,
  loading,
}: any) {
  const durationInfo = React.useMemo(() => {
    const s = parseTimeToMinutes(startTime);
    const e = parseTimeToMinutes(endTime);
    if (s == null || e == null) return { hours: null as number | null, overnight: false };
    const overnight = e < s;
    const mins = overnight ? 24 * 60 - s + e : e - s;
    const hours = Math.round((mins / 60) * 10) / 10;
    return { hours, overnight };
  }, [startTime, endTime]);

  return (
    <>    
      <h3>4) Locație, interval & pachet</h3>
      <div className='booking-form' style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Locație */}
        <LocationField
          apiKey={MAPS_KEY}
          value={location}
          onChange={(v: string) => {
            setLocation(v);
            setPlaceId(null);
          }}
          onSelect={(p: PlaceLite) => {
            setLocation(p.formattedAddress || p.displayName || '');
            setPlaceId(p.id || null);
          }}
          language='ro'
          region='RO'
        />
        {errors.location && <p className='error'>{errors.location}</p>}

        {/* Interval orar */}
        <div className='time-range' style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label>
            De la ora:
            <input
              type='time'
              step='1800'
              list='halfHourSteps'
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            />
          </label>
          <label>
            Până la ora:
            <input
              type='time'
              step='1800'
              list='halfHourSteps'
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
            />
          </label>
          <datalist id='halfHourSteps'>
            {Array.from({ length: 36 }, (_, i) => {
              const h = 6 + Math.floor(i / 2);
              const m = i % 2 === 0 ? '00' : '30';
              return <option key={`${h}:${m}`} value={`${pad2(h)}:${m}`} />;
            })}
          </datalist>
        </div>
        {(errors.startTime || errors.endTime) && <p className='error'>{errors.startTime || errors.endTime}</p>}

        {/* Durată estimată */}
        {durationInfo.hours != null && (
          <p style={{ fontSize: 12, color: '#aaa' }}>
            Durată estimată: <b>{durationInfo.hours}h</b>
            {durationInfo.overnight ? ' (trece de miezul nopții)' : ''}
          </p>
        )}

        {/* Pachete (tiles) */}
        <div className='price-configurator' style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PackageTiles
            packages={packagesNormalized as PkgInfo[]}
            selected={selectedPackages}
            onChange={setSelectedPackages}
          />

        <div className={styles['custom-config']}>
  {/* Switch for Custom Configuration */}
  {/* <label className={styles['custom-config__switch']}>
    <span>Configurează personalizat (foto/video)</span>
    <input
      type="checkbox"
      checked={showCustom}
      onChange={e => setShowCustom(e.target.checked)}
    />
    <span className={styles['custom-config__slider']} />
  </label> } */}

  
</div>


          {errors.package && <p className='error'>{errors.package}</p>}
          <p className='total-price'>Preț: {fmtRON(totalPrice)} RON</p>
        </div>

        <div className='input-group' style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={goBack}>Înapoi</button>
          <button
            onClick={submitBooking}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Trimite cererea
            {loading && <span className="btn-loader"></span>}
          </button>

        </div>
      </div>
    </>
  );
}
