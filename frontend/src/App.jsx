import { useState } from 'react';
import PatientManagement from './components/PatientManagement.jsx';
import AppointmentBooking from './components/AppointmentBooking.jsx';

const TABS = [
  { id: 'patients', label: 'Patients', Component: PatientManagement },
  { id: 'appointments', label: 'Book Appointment', Component: AppointmentBooking },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('patients');
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab).Component;

  return (
    <main>
      <h1>HMS — Patient Management</h1>
      <nav aria-label="Sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <ActiveComponent />
    </main>
  );
}
