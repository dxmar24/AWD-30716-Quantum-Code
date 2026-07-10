# Functional Programming and Functional Interfaces

## Objective

The academic reporting layer now includes a focused functional programming implementation. The goal is to show a real use of functional interfaces and pure functions inside the American Latin Class system, without adding artificial code that does not help the product.

## Where It Was Implemented

- `06Code/src/functional/reportMetrics.js`
- `06Code/src/controllers/ReportsController.js`
- `06Code/tests/unit/report-metrics.test.js`

The report controller still owns data access and permission scope. The new functional module owns the calculations for general reports, branch reports, attendance rates, pending payments, tuition income, event income, active students, retired students and level distribution.

## Functional Interfaces Used

JavaScript does not include native functional interfaces like Java. In this project, they are represented with JSDoc contracts:

- `Predicate<T>`: receives one value and returns `true` or `false`.
- `Mapper<T, R>`: transforms one value into another value.
- `Reducer<T, R>`: receives an accumulator and one value, then returns the next accumulator.
- `NumberSelector<T>`: extracts a numeric value from a record.
- `ReportMetricCalculator<TContext, TResult>`: receives report context and returns calculated metrics.

These contracts make the intent explicit and allow the team to explain the implementation as functional programming applied to business reporting.

## Functional Programming Practices Applied

- Pure functions calculate report values without reading the database.
- Inputs are not mutated.
- Functions receive behavior as parameters, for example `sumBy(payments, payment => payment.amount)`.
- Report totals are composed with `map`, `filter` and `reduce`.
- Business calculations are isolated from Express request handling.
- The same functions can be tested without starting the server.

## Business Value

For a school director, these reports answer operational questions:

- How many active students does each branch have?
- How many students are retired?
- How much tuition money was collected?
- How much money is still pending?
- How much show income was generated?
- What is the attendance rate?
- How are students distributed across B1 and B2 levels?

The functional implementation helps keep these calculations reliable, reusable and easier to audit.

## Evidence for Review

Run the automated tests:

```bash
cd 06Code
npm test -- --runTestsByPath tests/unit/report-metrics.test.js
```

Expected evidence:

- Tests pass for helper functions such as `sumBy`, `countBy`, `idSetFrom` and `toMoney`.
- Attendance rate behavior is verified.
- Branch report calculations are verified.
- General report totals are verified.
- Input immutability is verified.

Run the full backend test suite:

```bash
cd 06Code
npm test
```

## How to Explain It to the Professor

The system implements functional programming in the report layer. Instead of putting every calculation inside the controller, the project now uses pure functions and documented functional interfaces. The controller gathers authorized data, then passes that data to reusable calculation functions. Those functions use predicates, mappers, reducers and metric calculators to transform data into academic and financial reports.

This is not just a technical exercise. It supports real school management needs such as financial reports, attendance reports, branch reports and student status reports.
