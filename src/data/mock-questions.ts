// ============================================================
// VIGYANTRA 2026 — CODE RELAY
// MOCK DATA — Questions
// IMPORTANT: This file contains MOCK questions for UI development only.
// No real answer keys are stored here. MCQ answers are not stored
// anywhere accessible to the participant UI.
// Replace with Firebase Firestore queries in a later phase.
// ============================================================

import type { Question } from '../types/competition';

// ----------------------------------------------------------------
// Strike 1 — PREDICT (3 MCQ questions)
// ----------------------------------------------------------------
export const MOCK_STRIKE1_QUESTIONS: Question[] = [
  {
    id: 'q1-01',
    strikeId: 'strike1',
    type: 'mcq',
    index: 1,
    title: 'Output Prediction',
    statement: `What is the output of the following Java code?\n\n` +
      `for (int i = 0; i < 3; i++) {\n    System.out.print(i);\n}`,
    options: [
      { key: 'A', label: '012' },
      { key: 'B', label: '123' },
      { key: 'C', label: '013' },
      { key: 'D', label: '321' },
    ],
    language: 'java',
  },
  {
    id: 'q1-02',
    strikeId: 'strike1',
    type: 'mcq',
    index: 2,
    title: 'Variable Scope',
    statement: `What is the output of the following Python code?\n\n` +
      `x = 10\ndef foo():\n    x = 20\n    print(x)\nfoo()\nprint(x)`,
    options: [
      { key: 'A', label: '10\n10' },
      { key: 'B', label: '20\n20' },
      { key: 'C', label: '20\n10' },
      { key: 'D', label: 'Error' },
    ],
    language: 'python',
  },
  {
    id: 'q1-03',
    strikeId: 'strike1',
    type: 'mcq',
    index: 3,
    title: 'Array Bounds',
    statement: `What does the following C++ snippet print?\n\n` +
      `int arr[] = {5, 10, 15};\nint n = sizeof(arr) / sizeof(arr[0]);\ncout << n << " " << arr[n-1];`,
    options: [
      { key: 'A', label: '3 15' },
      { key: 'B', label: '3 10' },
      { key: 'C', label: '2 15' },
      { key: 'D', label: 'Runtime Error' },
    ],
    language: 'cpp',
  },
];

// ----------------------------------------------------------------
// Strike 2 — DEBUG (3 debug questions)
// ----------------------------------------------------------------
export const MOCK_STRIKE2_QUESTIONS: Question[] = [
  {
    id: 'q2-01',
    strikeId: 'strike2',
    type: 'debug',
    index: 1,
    title: 'Debug 01 — Logical Error',
    statement: 'Find and fix the logical error in the following function. ' +
      'It should return the sum of all even numbers from 1 to n.',
    starterCode:
      `def sum_even(n):\n    total = 0\n    for i in range(1, n + 1):\n        if i % 2 == 1:  # BUG: wrong condition\n            total += i\n    return total\n\nprint(sum_even(10))  # Expected: 30`,
    language: 'python',
  },
  {
    id: 'q2-02',
    strikeId: 'strike2',
    type: 'debug',
    index: 2,
    title: 'Debug 02 — Off-by-One',
    statement: 'The function below should find the maximum element in an array. ' +
      'Fix the off-by-one error.',
    starterCode:
      `public static int findMax(int[] arr) {\n    int max = arr[0];\n    for (int i = 1; i <= arr.length; i++) { // BUG\n        if (arr[i] > max) {\n            max = arr[i];\n        }\n    }\n    return max;\n}`,
    language: 'java',
  },
  {
    id: 'q2-03',
    strikeId: 'strike2',
    type: 'debug',
    index: 3,
    title: 'Debug 03 — Null Reference',
    statement: 'Fix the null-pointer issue in the following JavaScript function ' +
      'that reverses a string.',
    starterCode:
      `function reverseString(str) {\n    // BUG: does not handle null/undefined\n    return str.split('').reverse().join('');\n}\n\nconsole.log(reverseString(null)); // Should return ''`,
    language: 'javascript',
  },
];

// ----------------------------------------------------------------
// Strike 3 — CODE (3 coding questions)
// ----------------------------------------------------------------
export const MOCK_STRIKE3_QUESTIONS: Question[] = [
  {
    id: 'q3-01',
    strikeId: 'strike3',
    type: 'code',
    index: 1,
    title: 'Code 01 — Two Sum',
    statement: 'Given an array of integers and a target sum, return the indices ' +
      'of two numbers that add up to the target. Assume exactly one solution exists.',
    starterCode:
      `def two_sum(nums, target):\n    # Write your solution here\n    pass\n\n# Example:\n# two_sum([2, 7, 11, 15], 9) -> [0, 1]`,
    language: 'python',
  },
  {
    id: 'q3-02',
    strikeId: 'strike3',
    type: 'code',
    index: 2,
    title: 'Code 02 — Palindrome Check',
    statement: 'Write a function that checks if a given string is a palindrome. ' +
      'Ignore spaces, punctuation, and case.',
    starterCode:
      `public static boolean isPalindrome(String s) {\n    // Write your solution here\n    return false;\n}`,
    language: 'java',
  },
  {
    id: 'q3-03',
    strikeId: 'strike3',
    type: 'code',
    index: 3,
    title: 'Code 03 — Fibonacci',
    statement: 'Implement an efficient Fibonacci function that returns the nth Fibonacci ' +
      'number. Handle n = 0 and n = 1 as edge cases.',
    starterCode:
      `function fibonacci(n) {\n    // Write your solution here\n    // fib(0) = 0, fib(1) = 1\n}`,
    language: 'javascript',
  },
];

export const ALL_MOCK_QUESTIONS = [
  ...MOCK_STRIKE1_QUESTIONS,
  ...MOCK_STRIKE2_QUESTIONS,
  ...MOCK_STRIKE3_QUESTIONS,
];
