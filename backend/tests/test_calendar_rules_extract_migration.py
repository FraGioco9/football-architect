"""No secondary calendar placement source: versioned WORLD-TIME model is authoritative."""
import unittest
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
class CalendarRuleSeparationTest(unittest.TestCase):
 def test_permanent_divisions_no_longer_own_sporting_day_slots(self):
  self.assertFalse((ROOT/'data/calendar-rules.json').exists())
  divisions=json.loads((ROOT/'data/divisions.json').read_text(encoding='utf-8'))
  self.assertEqual(len(divisions),16)
  self.assertEqual(sum(len(d['rules']['phases']) for d in divisions),32)
  self.assertTrue(all('calendarEvents' not in p for d in divisions for p in d['rules']['phases']))
  source=(ROOT/'assets/world-calendar-model.js').read_text(encoding='utf-8')
  self.assertIn('WORLD-TIME-QA-06',source)
  self.assertIn('nationalDays',source)
if __name__=='__main__':unittest.main()
