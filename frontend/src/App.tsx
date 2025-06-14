import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingScreen from './LandingScreen';
import NodeGraph from './components/NodeGraph';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/visualization" element={<NodeGraph />} />
      </Routes>
    </Router>
  );
}
