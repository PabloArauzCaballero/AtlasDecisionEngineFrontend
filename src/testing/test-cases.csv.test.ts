import { parseTestCasesCsv } from './test-cases.csv';

describe('parseTestCasesCsv', () => {
  it('parses quoted JSON and optional fields', () => {
    const csv = [
      'caseCode,testName,inputJson,expectedResultJson,tagsJson,isActive',
      'approve_adult,"Adult, approved","{""age"":30}","{""outcome"":""APPROVED""}","[""critical""]",true',
    ].join('\n');

    expect(parseTestCasesCsv(csv)).toEqual([
      {
        caseCode: 'APPROVE_ADULT',
        testName: 'Adult, approved',
        input: { age: 30 },
        expectedResult: { outcome: 'APPROVED' },
        tags: ['critical'],
        isActive: true,
      },
    ]);
  });

  it('reports the row containing invalid JSON', () => {
    expect(() =>
      parseTestCasesCsv(
        'caseCode,testName,inputJson,expectedResultJson\nCASE_1,Invalid,{nope},"{""ok"":true}"',
      ),
    ).toThrow('Fila 2');
  });

  it('rejects duplicate case codes before calling the backend', () => {
    const csv = [
      'caseCode,testName,inputJson,expectedResultJson',
      'CASE_1,First,"{}","{}"',
      'case_1,Second,"{}","{}"',
    ].join('\n');
    expect(() => parseTestCasesCsv(csv)).toThrow('caseCode duplicados');
  });
});
