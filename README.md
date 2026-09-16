# BAXI

BAXI is a prototype ride-hailing and freight app built for a database course. It is a PyQt6 desktop app with a phone-sized window, backed by MySQL, and it connects clients with drivers for four transport services.

## Overview

Clients can request one of four services:

| Service | Purpose |
| --- | --- |
| **BAXI** | Passenger rides |
| **BAXI WOMEN** | Passenger rides with female drivers and riders only |
| **BAXI BOX** | Light goods delivery (motorbike) |
| **BAXI BAAR** | Heavy cargo transport |

When a client places a request, drivers who meet the service requirements can accept it and receive the pickup and drop-off coordinates. After a trip, drivers and clients can rate each other. A separate admin and employee app handles staff and driver verification.

> Development is still in progress. Some screens and features are not finished or have not been fully tested.

## Features

### User app (`BAXI_MinWindow.py`)

- Sign-up and sign-in by phone number with a generated 4-digit verification code. The code is printed to the console because SMS is not connected.
- Choose a role: client or driver.
- **Driver onboarding:** name, gender, birth date, national ID, document photos, bank account (IBAN) number, then vehicle details for the chosen service (name, color, plate, fuel type, capacity, production date).
- **Client home:** request any of the four services, see the fare estimate, and cancel a booking.
- **Driver home:** go on or off duty, accept a request, and mark each step of the trip (arrived at pickup, passenger on board, arrived at destination). Rate the trip at the end.
- Account settings, wallet and payment method screens, and trip history.
- Distances are calculated with `geopy`, and fares use a per-kilometre rate for each service type. Reverse geocoding uses the Neshan API.

### Admin and employee app (`BAXI_Admin_Employee_MinWindow.py`)

- Admin and employee sign-in with personnel code and password.
- Admins can hire new employees.
- Employees can review unverified drivers' documents and approve or reject them.
- A query screen is planned for the 20 report queries in `database.py`. Its buttons are not connected yet.

### Database (`db/main.sql`)

- Two MySQL schemas:
  - `baxi_staff`: employees, and a `managers` view
  - `baxi_users`: clients, drivers, vehicles for each service, service requests, trips, heavy and light transports, service acceptances, transactions, deposits and withdrawals, referrals, addresses and destinations, compliments and complaints, reports, company and compensatory deposits, monthly incomes
- Triggers keep wallets up to date after service acceptances, deposits and withdrawals.
- The EER diagram and table specifications are in `EER/`.

## Tech stack

- Python 3.10+
- PyQt6 (screens designed in Qt Designer, `.ui` files in `qt_ui/`)
- MySQL through `mysql-connector-python`
- `requests` (Neshan reverse geocoding) and `geopy` (distance calculation)

## Project structure

```text
.
├── EER/                 # EER diagram (draw.io) and table specifications
├── db/
│   ├── main.sql         # Schemas, tables, views and triggers
│   └── data.xlsx        # Sample data
├── qt_ui/               # Qt Designer sources for both apps
├── requirement.txt
└── src/
    ├── BAXI_MinWindow.py                 # User app entry point (client and driver)
    ├── BAXI.py                           # Generated UI for the user app
    ├── BAXI_Admin_Employee_MinWindow.py  # Admin and employee app entry point
    ├── BAXI_Admin_Employee.py            # Generated UI for the admin app
    ├── database.py                       # MySQL connection, inserts, lookups, report queries
    ├── set_info.py                       # Builds the dicts that are inserted into the database
    ├── client.py, driver.py, employee.py, trip.py
    ├── verify.py                         # Sign-in and verification helpers
    ├── generate_random_number.py         # Verification codes and random IDs
    ├── get_lat_lon_info.py               # Reverse geocoding, distance and fare functions
    ├── show_map.py                       # Experimental embedded map window (QtWebEngine)
    └── test_server.py                    # Manual database test script
```

## Getting started

1. **Set up MySQL.** Run `db/main.sql` on a MySQL server to create the `baxi_staff` and `baxi_users` schemas.
2. **Point the app at your server.** The connection settings are in `create_connection()` in `src/database.py`. Change them to your own host, port and user, preferably by loading them from environment variables instead of writing them in the code.
3. **Set a geocoding key.** Put your own Neshan API key in `src/get_lat_lon_info.py`.
4. **Install the dependencies.** `requirement.txt` lists some standard-library modules and non-installable names, so install the packages directly:

   ```bash
   pip install PyQt6 PyQt6-WebEngine mysql-connector-python requests geopy
   ```

5. **Run an app** from the `src` directory:

   ```bash
   cd src
   python BAXI_MinWindow.py                  # user app
   python BAXI_Admin_Employee_MinWindow.py   # admin and employee app
   ```

## Design

- Figma, user app: https://www.figma.com/file/VVgkoPjr2XQsAXT3FawZph/BAXI?type=design&node-id=149%3A350&mode=design&t=OCoCOrdzqbq9VW2e-1
- Figma, admin app: https://www.figma.com/file/f16EVeUFA5VmUyYbdSXhBd/BAXI_Admin?type=design&node-id=0%3A1&mode=design&t=IeB6MJW0liNXcbxe-1

## Team

Built by Navid, Sajad and Arsham as a database course project (db4022) at Bu-Ali Sina University.
