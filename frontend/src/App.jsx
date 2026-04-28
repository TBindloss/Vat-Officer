import React, { useState } from 'react'
import Layout from './components/Layout'
import Checklist from './components/Checklist'
import FlightData from './components/FlightData'
import RadioData from './components/RadioData'
import ACARS from './components/ACARS'
import ATISLookup from './components/ATISLookup'
import About from './components/About'
import DataPrivacy from './components/DataPrivacy'
import TermsOfUse from './components/TermsOfUse'
import DevelopmentWarning from './components/DevelopmentWarning'

function App() {
  const [activePage, setActivePage] = useState('flight-data')

  const renderPageContent = () => {
    switch (activePage) {
      case 'checklists':
        return <Checklist />
      case 'flight-data':
        return <FlightData />
      case 'radio':
        return <RadioData />
      case 'acars':
        return <ACARS />
      case 'atis-lookup':
        return <ATISLookup />
      case 'about':
        return <About />
      case 'data-privacy':
        return <DataPrivacy />
      case 'terms-of-use':
        return <TermsOfUse />
      default:
        return <FlightData />
    }
  }

  return (
    <>
      <DevelopmentWarning />
      <Layout activePage={activePage} onNavigate={setActivePage}>
        {renderPageContent()}
      </Layout>
    </>
  )
}

export default App
