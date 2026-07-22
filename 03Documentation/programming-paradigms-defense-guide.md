# Programming Paradigms Defense Guide

This guide maps each requested concept to production code, a live demonstration and an accurate explanation. Do not claim that the entire system follows only one paradigm; the architecture is intentionally hybrid.

## 1. Functional Interfaces

Open `06Code/backend/src/functional/reportMetrics.js`, lines 8-35.

The JSDoc contracts `Predicate<T>`, `Mapper<T,R>`, `Reducer<T,R>`, `NumberSelector<T>` and `ReportMetricCalculator<TContext,TResult>` describe functions with one callable responsibility. JavaScript has no Java-style `@FunctionalInterface`; here the interface is a documented callback contract and the behavior is verified by tests.

Then show `sumBy` and `countBy` near lines 53-69. They are higher-order functions because they receive another function:

```js
sumBy(payments, (payment) => payment.amount);
countBy(students, (student) => student.active !== false);
```

The algorithm stays unchanged while the callback decides what value to select or what condition to evaluate.

## 2. Lambda Functions

JavaScript arrow functions are the lambda syntax used by the project.

- `reportMetrics.js`: selectors, predicates and reducers passed to `map`, `filter` and `reduce`.
- `06Code/backend/src/routes/api.js:22`: `wrap` returns a new function that adapts asynchronous controllers to Express error handling.
- `06Code/frontend/src/components/reports/ReportsPanel.jsx:274`: a lambda filters students according to current report filters.

A lambda is anonymous behavior that can be stored, passed and executed by another function. It is not merely shorter syntax in this project; callbacks parameterize reusable calculations.

## 3. Pure Functions And Immutability

Open `buildAcademicReport` and `buildAttendanceReport` in `reportMetrics.js`. They receive all data, filters and the reference date as parameters. They do not query PostgreSQL, read Express state or mutate their source.

Evidence: `06Code/backend/tests/unit/report-metrics.test.js:244` verifies that report functions do not mutate their input. The same file verifies `map`/`reduce` composition and attendance filtering.

Equal input data plus the same reference date produces the same output. Injecting time makes date-sensitive financial and attendance results reproducible.

## 4. Reactive Programming

Open `06Code/frontend/src/components/reports/ReportsPanel.jsx:187-203`.

`useState` represents report mode, section, filters, result, loading and errors. `useEffect` reacts when the selected report context changes and loads new information. User events update state; React automatically recalculates and renders only the affected view.

The public hero provides another concise example in `06Code/frontend/src/main.jsx:227-249`:

- `IntersectionObserver` reacts to whether the hero is visible.
- A four-second interval changes the active photograph only while that section is visible.
- Leaving the section or unmounting clears the interval.

The UI is driven by state changes and event streams instead of a manual sequence of DOM mutations.

## 5. Non-Blocking Programming

Open `06Code/frontend/src/main.jsx:1831`.

`Promise.all` starts independent dashboard requests together. While network and PostgreSQL work are pending, Node's event loop can continue serving other requests. Express controllers use `async`/`await`, and `src/routes/api.js:22` converts rejected promises into centralized error handling.

Open `06Code/apis/python-analytics-api/app/main.py:36`. The FastAPI cache middleware is `async` and awaits the next ASGI handler without blocking the server loop. The analytics database repository is synchronous, so FastAPI executes regular `def` path operations in its worker thread pool instead of on the event loop.

Non-blocking does not mean the result is immediate. It means the waiting task does not monopolize the main execution thread.

## 6. Blocking Programming

Open `06Code/backend/src/utils/passwordHasher.js:11-40`.

`crypto.scryptSync` is intentionally synchronous: the request waits for password derivation before authentication can continue. This is a real blocking example at a narrow security boundary.

At higher concurrency, the project should use asynchronous `crypto.scrypt` or worker threads so CPU-heavy password derivation cannot delay unrelated requests. Do not call PostgreSQL or HTTP "blocking" merely because `await` pauses the current function; `await` yields control to the event loop for promise-based I/O.

## 7. Complete Code Flow

```text
GET /api/v1/reports/attendance
  -> route lambda/wrapper
  -> ReportsController validates filters and performs authorized I/O
  -> reportMetrics receives plain data
  -> predicates, mappers and reducers create the report
  -> React state receives the result
  -> reactive rendering updates tables and charts
  -> CSV or print/PDF exports the current filtered view
```

## 8. Evidence Commands

From `06Code`:

```powershell
npm test -- --runInBand --runTestsByPath tests/unit/report-metrics.test.js
npm run test:api:validation
```

In the running project:

1. Sign in as General Director.
2. Open Reportes, then Asistencia detallada.
3. Change date, branch, level, student, group or attendance status.
4. Apply filters and show the reactive loading/result transition.
5. Export CSV and use Imprimir / PDF.
6. Relate the displayed result to `buildAttendanceReport`.

## 9. Short Oral Summary

> The project combines object-oriented services with a functional reporting core. JSDoc defines callback contracts, lambdas provide behavior to higher-order functions, pure transformations create auditable metrics, React responds to state changes, asynchronous I/O avoids blocking the event loop, and synchronous scrypt is the explicit blocking example at the password boundary.
