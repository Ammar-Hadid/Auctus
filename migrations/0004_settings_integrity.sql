CREATE TABLE settings_v2 (id INTEGER PRIMARY KEY CHECK(id=1), selected_program_id TEXT REFERENCES program(id));
INSERT INTO settings_v2 SELECT * FROM settings;
DROP TABLE settings;
ALTER TABLE settings_v2 RENAME TO settings;
