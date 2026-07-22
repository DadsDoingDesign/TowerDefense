import { BattleScreen } from './ui/screens/BattleScreen'
import './styles/app.css'

/**
 * M1 renders straight into the battle screen. Later milestones add a screen
 * router (Hub / Run map / Endless) around this.
 */
export default function App() {
  return (
    <div className="app-root">
      <BattleScreen />
    </div>
  )
}
