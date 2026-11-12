-- Run: docker exec -i booking-hotel-postgres psql -U postgres -d booking_hotel -v ON_ERROR_STOP=1 < apps/api/prisma/checks/constraints.sql
BEGIN;

CREATE FUNCTION pg_temp.expect_fail(stmt text, code text) RETURNS void AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'expected SQLSTATE % but statement succeeded: %', code, stmt;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE <> code THEN
    RAISE EXCEPTION 'expected SQLSTATE %, got % (%): %', code, SQLSTATE, SQLERRM, stmt;
  END IF;
END $$ LANGUAGE plpgsql;

INSERT INTO users (id, email, password_hash, name, updated_at) VALUES ('t_user', 't@test.local', 'x', 'T', now());
INSERT INTO hotels (id, name, slug, city, address, updated_at) VALUES ('t_hotel', 'T', 't-hotel', 'C', 'A', now());
INSERT INTO room_types (id, hotel_id, name, capacity, base_price, updated_at) VALUES ('t_rt', 't_hotel', 'RT', 2, 1000, now());
INSERT INTO rooms (id, room_type_id, number, updated_at) VALUES ('t_r1', 't_rt', '101', now()), ('t_r2', 't_rt', '102', now());
INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b1', 'T1', 't_user', 't_r1', 'G', 'g@test.local', 1, '2027-01-10', '2027-01-13', 'CONFIRMED', 3000, 'THB', now());

-- overlapping active booking on the same room is rejected
SELECT pg_temp.expect_fail($q$INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b2', 'T2', 't_user', 't_r1', 'G', 'g@test.local', 1, '2027-01-12', '2027-01-14', 'PENDING', 2000, 'THB', now())$q$, '23P01');
-- overlapping CANCELLED booking is allowed
INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b3', 'T3', 't_user', 't_r1', 'G', 'g@test.local', 1, '2027-01-11', '2027-01-12', 'CANCELLED', 1000, 'THB', now());
-- back-to-back (checkOut = next checkIn) is allowed
INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b4', 'T4', 't_user', 't_r1', 'G', 'g@test.local', 1, '2027-01-13', '2027-01-15', 'CONFIRMED', 2000, 'THB', now());
-- same dates on a different room is allowed
INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b5', 'T5', 't_user', 't_r2', 'G', 'g@test.local', 1, '2027-01-10', '2027-01-13', 'PENDING', 3000, 'THB', now());
-- zero nights and zero guests are rejected
SELECT pg_temp.expect_fail($q$INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b6', 'T6', 't_user', 't_r2', 'G', 'g@test.local', 1, '2027-02-01', '2027-02-01', 'PENDING', 0, 'THB', now())$q$, '23514');
SELECT pg_temp.expect_fail($q$INSERT INTO bookings (id, code, user_id, room_id, guest_name, guest_email, guests, check_in, check_out, status, total_amount, currency, updated_at)
  VALUES ('t_b7', 'T7', 't_user', 't_r2', 'G', 'g@test.local', 0, '2027-02-01', '2027-02-02', 'PENDING', 1000, 'THB', now())$q$, '23514');

-- rate periods: overlap rejected, adjacent allowed, empty range rejected
INSERT INTO rate_periods (id, room_type_id, start_date, end_date, price, updated_at) VALUES ('t_p1', 't_rt', '2027-04-10', '2027-04-17', 1500, now());
SELECT pg_temp.expect_fail($q$INSERT INTO rate_periods (id, room_type_id, start_date, end_date, price, updated_at) VALUES ('t_p2', 't_rt', '2027-04-15', '2027-04-20', 1600, now())$q$, '23P01');
INSERT INTO rate_periods (id, room_type_id, start_date, end_date, price, updated_at) VALUES ('t_p3', 't_rt', '2027-04-17', '2027-04-20', 1600, now());
SELECT pg_temp.expect_fail($q$INSERT INTO rate_periods (id, room_type_id, start_date, end_date, price, updated_at) VALUES ('t_p4', 't_rt', '2027-05-01', '2027-05-01', 1600, now())$q$, '23514');

-- review rating outside 1..5 is rejected
SELECT pg_temp.expect_fail($q$INSERT INTO reviews (id, booking_id, user_id, hotel_id, rating, updated_at) VALUES ('t_v1', 't_b1', 't_user', 't_hotel', 6, now())$q$, '23514');

DO $$ BEGIN RAISE NOTICE 'ALL CONSTRAINT CHECKS PASSED'; END $$;
ROLLBACK;
