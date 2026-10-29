"""Verify calendar rules extraction matches the exact original Season1 approved source structure."""
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class CalendarRulesExtractTest(unittest.TestCase):
 def test_all_division_phases_have_one_unique_mapping(self):
  divisions=json.loads((ROOT/'data/divisions.json').read_text(encoding='utf-8'))
  rule=json.loads((ROOT/'data/calendar-rules.json').read_text(encoding='utf-8'))
  expected={(d['id'],p['id']) for d in divisions for p in d['rules']['phases']}
  got=[(e['competitionId'],e['phaseId']) for e in rule['domesticPhases']]
  self.assertEqual(len(got),len(expected))
  self.assertEqual(set(got),expected)
  self.assertTrue(all('calendarEvents' not in p for d in divisions for p in d['rules']['phases']))
  for e in rule['domesticPhases']:
   expected_markers=['N'+str(i).zfill(2) for i in (range(1,31) if e['phaseId']=='league' else range(31,33) if e['phaseId']=='playout' else range(31,34))]
   self.assertEqual(e['markers'],expected_markers)
if __name__=='__main__':unittest.main()
