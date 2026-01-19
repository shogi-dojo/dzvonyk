import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { Layout } from './components/Layout';
import { AppInitializer } from './components/AppInitializer';
import {
  Dashboard,
  Teachers,
  Subjects,
  Students,
  Activities,
  Rooms,
  Constraints,
  Generate,
  Timetable,
  Settings,
} from './pages';

function App() {
  return (
    <Provider store={store}>
      <AppInitializer>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/teachers" element={<Teachers />} />
              <Route path="/subjects" element={<Subjects />} />
              <Route path="/students" element={<Students />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/activity-tags" element={<Navigate to="/activities" replace />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/constraints" element={<Constraints />} />
              <Route path="/generate" element={<Generate />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </HashRouter>
      </AppInitializer>
    </Provider>
  );
}

export default App;
