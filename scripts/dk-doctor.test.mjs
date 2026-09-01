import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIAGNOSTIC_CLASSES,
  runDoctorDiagnostics,
} from '../runtime/diagnostics/dk-doctor.mjs';

test('DK Doctor: Correctly diagnoses host capability unsupported status without attributing as DKF runtime defect', () => {
  const result = runDoctorDiagnostics({
    capabilities: { guaranteedMediation: false },
  });

  const hostReport = result.reports.find((r) => r.domain.includes('Guaranteed Execution Mediation'));
  assert.ok(hostReport);
  assert.equal(hostReport.status, 'UNSUPPORTED');
  assert.equal(hostReport.class, DIAGNOSTIC_CLASSES.UNSUPPORTED_HOST_CAPABILITY);

  const runtimeReport = result.reports.find((r) => r.domain === 'Development Kit Runtime');
  assert.ok(runtimeReport);
  assert.equal(runtimeReport.status, 'PASS');
});
