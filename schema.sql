-- STAFF TABLE
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  sn TEXT,
  name TEXT,
  email TEXT UNIQUE,
  personalEmail TEXT,
  nid TEXT,
  joinDate TEXT,
  phone TEXT,
  gender TEXT,
  department TEXT,
  position TEXT,
  isSMT INTEGER DEFAULT 0, -- SQLite uses 0/1 for booleans
  balanceVisible INTEGER DEFAULT 0,
  notes TEXT,
  basicSalary REAL DEFAULT 0,
  dailyAllowance REAL DEFAULT 0,
  holidayAllowanceRate REAL DEFAULT 0,
  bankAccount TEXT,
  status TEXT DEFAULT 'active',
  createdAt TEXT
);

-- ROSTER ENTRIES
CREATE TABLE IF NOT EXISTS roster_entries (
  id TEXT PRIMARY KEY,
  staffId TEXT,
  staffName TEXT,
  staffDepartment TEXT,
  date TEXT,
  shiftTime TEXT,
  status TEXT,
  leaveRequestId TEXT,
  createdAt TEXT
);

-- LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  staffId TEXT,
  staffName TEXT,
  staffDepartment TEXT,
  staffSN TEXT,
  staffGender TEXT,
  leaveType TEXT,
  startDate TEXT,
  endDate TEXT,
  days INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  requestedAt TEXT,
  requestedBy TEXT,
  reviewedBy TEXT,
  reviewedAt TEXT,
  reviewNotes TEXT
);

-- FLIGHTS
CREATE TABLE IF NOT EXISTS flights (
  id TEXT PRIMARY KEY,
  date TEXT,
  flightNo TEXT,
  type TEXT,
  aircraft TEXT,
  bookedFigure TEXT,
  checkInTime TEXT,
  arrivalTime TEXT,
  departureTime TEXT,
  route TEXT,
  originDepTime TEXT,
  status TEXT,
  remarks TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

-- OVERTIME ENTRIES
CREATE TABLE IF NOT EXISTS overtime_entries (
  id TEXT PRIMARY KEY,
  staffId TEXT,
  staffName TEXT,
  staffSN TEXT,
  staffDepartment TEXT,
  date TEXT,
  startTime TEXT,
  endTime TEXT,
  hours REAL,
  notes TEXT,
  createdAt TEXT,
  createdBy TEXT
);

-- USERS (If you want to sync Firebase Auth roles)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Firebase Auth UID
  email TEXT UNIQUE,
  role TEXT,
  department TEXT
);