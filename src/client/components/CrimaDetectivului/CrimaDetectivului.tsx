import React from 'react'
import CrimaHero from './CrimaHero'
import DetectivHacker from './DetectivHacker'
import Criminali from './Criminali'
import InregistrariSuspecti from './InregistrariSuspecti'
import Interogari from './Interogari'
import BreakingNewsBanner from './BreakingNewsBanner'
import { Footer } from '../Footer/Footer'

function CrimaDetectivului() {
  return (
      <div>
      <CrimaHero  />
      <DetectivHacker />
      <Criminali />
      <InregistrariSuspecti />
      <Interogari />
      <BreakingNewsBanner />
      <Footer />
    </div>
  )
}

export default CrimaDetectivului
