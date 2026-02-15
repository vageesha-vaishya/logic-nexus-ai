
const formatDateForInput = (dateVal: any): string => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

const testCases = [
    '2023-10-25T14:30:00.000Z',
    '2023-10-25',
    '2023/10/25',
    null,
    undefined,
    'invalid-date'
];

testCases.forEach(tc => {
    console.log(`Input: ${tc} => Output: "${formatDateForInput(tc)}"`);
});
