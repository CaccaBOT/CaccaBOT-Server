const db = require('better-sqlite3')('./storage/db.sqlite3')
const crypto = require('crypto')
const argon2 = require('argon2')

function initDatabase() {
	db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS user (
            id TEXT PRIMARY KEY,
            phone TEXT,
            username TEXT,
			password TEXT,
			frozen INTEGER DEFAULT 0,
			token TEXT,
            pfp TEXT,
            bio TEXT,
			money INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS poop (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            timestamp TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE ON UPDATE CASCADE
        );

		CREATE TABLE IF NOT EXISTS rarity (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE,
			chance INTEGER
		);

		CREATE TABLE IF NOT EXISTS collectible (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE,
			description TEXT,
			rarity_id INTEGER,
			asset_url TEXT,
			FOREIGN KEY (rarity_id) REFERENCES rarity(id)
		);

		CREATE TABLE IF NOT EXISTS user_collectible (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            collectible_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY (collectible_id) REFERENCES collectible(id) ON DELETE CASCADE ON UPDATE CASCADE
        );

		INSERT OR IGNORE INTO rarity(name, chance) VALUES ('Merdume', 59);
		INSERT OR IGNORE INTO rarity(name, chance) VALUES ('Escrementale', 30); 
		INSERT OR IGNORE INTO rarity(name, chance) VALUES ('Sensazianale', 10); 
		INSERT OR IGNORE INTO rarity(name, chance) VALUES ('Caccasmagorico', 1); 

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('VulcANO', 'Cacca con parte superiore a forma di vulcano che erutta magma', 
				(SELECT id FROM rarity WHERE name = 'Merdume'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Jeff Merdos', 'Cacca dorata con i baffi da nobile, un bastone e un monocolo', 
				(SELECT id FROM rarity WHERE name = 'Caccasmagorico'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Scopino', NULL, 
				(SELECT id FROM rarity WHERE name = 'Merdume'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Cesso', NULL, 
				(SELECT id FROM rarity WHERE name = 'Merdume'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Carta Igienica', NULL, 
				(SELECT id FROM rarity WHERE name = 'Merdume'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Cacapops', 'Cacca a forma di palline come quella dei conigli o dei cereali cocopops', 
				(SELECT id FROM rarity WHERE name = 'Escrementale'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Una giornata di merda', 'Merdachan al cesso', 
				(SELECT id FROM rarity WHERE name = 'Caccasmagorico'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Supercacca', 'Cacca con mantello da supereroe e una grande "C" sul petto', 
				(SELECT id FROM rarity WHERE name = 'Sensazianale'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Merdinfiore', 'Cacca da cui sboccia un fiore', 
				(SELECT id FROM rarity WHERE name = 'Merdume'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Merdangelo', 'Cacca con ali e aureola', 
				(SELECT id FROM rarity WHERE name = 'Sensazianale'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Robomerda', 'Cacca con sembianze robotiche', 
				(SELECT id FROM rarity WHERE name = 'Sensazianale'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Cesso di Jeff Merdos', 'Cesso dorato (di Jeff Merdos)', 
				(SELECT id FROM rarity WHERE name = 'Caccasmagorico'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Cacca Samurai', 'Cacca con sembianze di un samurai (armatura, elmetto, spada)', 
				(SELECT id FROM rarity WHERE name = 'Merdume'), NULL);

		INSERT OR IGNORE INTO collectible (name, description, rarity_id, asset_url)
		VALUES ('Caccantante', NULL, 
				(SELECT id FROM rarity WHERE name = 'Merdume'), NULL);
    `)
}

async function login(username, password) {
	const user = db.prepare(`SELECT * FROM user WHERE username = ?`).get(username)

	if (!user) {
		return null
	}

	if (!(await argon2.verify(user.password, password))) {
		return null
	}

	return user
}

function getUserByToken(token) {
	const user = db.prepare(`SELECT * FROM user WHERE token = ?`).get(token)
	if (user) {
		user.frozen = Boolean(user.frozen)
	}

	return user
}

function generateToken(id) {
	const token = crypto.randomBytes(64).toString('hex')
	db.prepare(`UPDATE user SET token = ? WHERE id = ?`).run(token, id)
	return token
}

async function updatePassword(id, password) {
	const hash = await argon2.hash(password)
	db.prepare(`UPDATE user SET password = ? WHERE id = ?`).run(hash, id)
	generateToken(id)
}

async function updateUsername(id, username) {
	db.prepare(`UPDATE user SET username = ? WHERE id = ?`).run(username, id)
}

function createUser(id, username, bio) {
	let phone = sanitizePhone(id)
	id = hashId(id)

	db.prepare(
		`INSERT INTO user (id, phone, username, bio) VALUES (?, ?, ?, ?)`
	).run(id, phone, username, bio)
}

function getUserCollectibles(user) {
    return db.prepare(`
        SELECT c.name, c.description, c.asset_url, r.name as rarity, COUNT(uc.collectible_id) AS quantity
        FROM collectible c
        JOIN user_collectible uc ON uc.collectible_id = c.id
        JOIN user u ON uc.user_id = u.id
        JOIN rarity r ON c.rarity_id = r.id
        WHERE u.id = ?
        GROUP BY c.id, r.name
        ORDER BY r.id DESC
    `).all(user)
}


function setMoney(user, amount) {
	db.prepare(`UPDATE user SET money = ? WHERE id = ?`).run(amount, user)
}

function addCollectibleToUser(user, collectible) {
	db.prepare(`INSERT INTO user_collectible(user_id, collectible_id) VALUES(?, ?)`).run(user, collectible)
}

function getRarities() {
	return db.prepare(`SELECT * FROM rarity`).all();
}

function getCollectibles(rarity) {
	return db.prepare(`SELECT * FROM collectible WHERE rarity_id = ?`).all(rarity)
}

function getUserProfileById(id) {
	return db
		.prepare(
			'SELECT u.*, COUNT(p.id) as poops FROM user u JOIN poop p ON u.id = p.user_id WHERE u.id = ?'
		)
		.get(id)
}

function getUserProfileByUsername(username) {
	return db
		.prepare(
			'SELECT u.*, COUNT(p.id) as poops FROM user u JOIN poop p ON u.id = p.user_id WHERE u.username = ?'
		)
		.get(username)
}

function getUserProfileByPhone(phone) {
	phone = sanitizePhone(phone)
	return db
		.prepare(
			'SELECT u.*, COUNT(p.id) as poops FROM user u LEFT JOIN poop p ON u.id = p.user_id WHERE u.phone = ?'
		)
		.get(phone)
}

function getLastPoop() {
	return db.prepare(`SELECT * FROM poop ORDER BY id DESC LIMIT 1`).get()
}

function addPoop(id) {
	db.prepare(`INSERT INTO poop (user_id, timestamp) VALUES (?, ?)`).run(
		id,
		new Date().toISOString()
	)
}

function addPoopWithTimestamp(id, timestamp) {
	db.prepare(`INSERT INTO poop (user_id, timestamp) VALUES (?, ?)`).run(
		id,
		timestamp
	)
}

function poopLeaderboard() {
    const result = db
        .prepare(
            `
            SELECT u.id, u.phone, u.username, u.pfp, u.bio, u.frozen, u.money,
                   poops,
                   ROW_NUMBER() OVER (ORDER BY poops DESC) AS rank
            FROM (
                SELECT p.user_id, 
                       COUNT(*) AS poops
                FROM poop p 
                GROUP BY p.user_id
            ) AS poops
            JOIN user u ON poops.user_id = u.id
            ORDER BY poops DESC
        `
        )
        .all();

    return result.map(row => ({
        ...row,
        frozen: Boolean(row.frozen)
    }))
}


function poopLeaderboardWithFilter(year, month) {
    const result = db
        .prepare(
            `
        SELECT u.id, u.phone, u.username, u.pfp, u.bio, u.frozen, u.money, 
               poops,
               ROW_NUMBER() OVER (ORDER BY poops DESC) AS rank
        FROM (
            SELECT p.user_id, 
                   COUNT(*) AS poops
            FROM poop p 
            WHERE strftime('%Y', p.timestamp) = ? 
                  AND strftime('%m', p.timestamp) = ?
            GROUP BY p.user_id
        ) AS poop_counts
        JOIN user u ON poop_counts.user_id = u.id
        ORDER BY poops DESC
    `
        )
        .all(year.toString(), month.toString().padStart(2, '0'))

		return result.map(row => ({
			...row,
			frozen: Boolean(row.frozen)
		}))
}


function allPoop() {
	return db
		.prepare(
			'SELECT p.*, u.username as username FROM poop p JOIN user u ON p.user_id = u.id'
		)
		.all()
}

function allPoopWithFilter(year, month) {
	const startOfMonth = new Date(Date.UTC(year, month - 1, 1))
	const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

	const startOfMonthIso = startOfMonth.toISOString()
	const endOfMonthIso = endOfMonth.toISOString()

	return db
		.prepare(
			`SELECT p.*, u.username
         FROM poop p
		 JOIN user u
		 ON (p.user_id = u.id)
         WHERE p.timestamp >= ? AND p.timestamp <= ?`
		)
		.all(startOfMonthIso, endOfMonthIso)
}

function getPoopsFromUser(id) {
	return db
		.prepare(
			'SELECT p.* FROM poop p JOIN user u ON p.user_id = u.id WHERE u.id = ?'
		)
		.all(id)
}

function getPoopsFromUserWithFilter(id, year, month) {
	const startOfMonth = new Date(Date.UTC(year, month - 1, 1))
	const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

	const startOfMonthIso = startOfMonth.toISOString()
	const endOfMonthIso = endOfMonth.toISOString()

	return db
		.prepare(
			`SELECT p.*
         FROM poop p
         JOIN user u ON p.user_id = u.id
         WHERE u.id = ? AND p.timestamp >= ? AND p.timestamp <= ?`
		)
		.all(id, startOfMonthIso, endOfMonthIso)
}

function poopStatsFromUser(id) {
	const now = new Date()
	const todayStart = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	)
	const todayEnd = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			23,
			59,
			59,
			999
		)
	)

	// Calculate start of the week and start of the month in UTC
	const startOfWeek = new Date(todayStart)
	startOfWeek.setUTCDate(todayStart.getUTCDate() - todayStart.getUTCDay())

	const startOfMonth = new Date(todayStart)
	startOfMonth.setUTCDate(1)

	// Convert dates to ISO strings
	const today = todayStart.toISOString()
	const todayEndSqlite = todayEnd.toISOString()
	const weekStart = startOfWeek.toISOString()
	const monthStart = startOfMonth.toISOString()

	// Query the database
	const todayPoops = db
		.prepare(
			`SELECT COUNT(*) as today FROM poop WHERE timestamp BETWEEN ? AND ? AND poop.user_id = ?`
		)
		.get(today, todayEndSqlite, id)

	const weeklyPoops = db
		.prepare(
			`SELECT COUNT(*) as week FROM poop WHERE timestamp >= ? AND poop.user_id = ?`
		)
		.get(weekStart, id)

	const monthlyPoops = db
		.prepare(
			`SELECT COUNT(*) as month FROM poop WHERE timestamp >= ? AND poop.user_id = ?`
		)
		.get(monthStart, id)

	const totalPoops = db
		.prepare(`SELECT COUNT(*) as total FROM poop WHERE poop.user_id = ?`)
		.get(id)

	return {
		today: todayPoops.today,
		week: weeklyPoops.week,
		month: monthlyPoops.month,
		total: totalPoops.total,
	}
}

function poopStreak(id) {
	const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
	let days = db
		.prepare(
			`
			SELECT DATE(p.timestamp) as days
			FROM poop p JOIN user u ON p.user_id = u.id
			WHERE u.id = ?
			GROUP BY days
			ORDER BY days;
		`
		)
		.all(id)
		.map((x) => x.days)

	days.push(
		`${new Date().getFullYear()}-${(new Date().getMonth() + 1)
			.toString()
			.padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`
	)

	let streak = 0

	for (let i = days.length - 1; i > 0; i--) {
		const diff = new Date(days[i]) - new Date(days[i - 1])
		if (diff == DAY_IN_MILLISECONDS || diff == 0) {
			streak++
		} else {
			break
		}
	}

	return streak
}

function poopStatsFromUserWithFilter(id, year, month) {
	const currentDate = new Date()
	const currentYear = currentDate.getFullYear()
	const currentMonth = currentDate.getMonth() + 1
	const currentDay = currentDate.getDate()
	let daysConsidered
	if (year == currentYear && month == currentMonth) {
		daysConsidered = currentDay
	} else {
		daysConsidered = new Date(year, month, 0).getDate()
	}
	const monthlyLeaderboardPosition = poopLeaderboardWithFilter(
		year,
		month
	).find((x) => x.id === id)?.rank ?? 0
	const streak = poopStreak(id)
	const poops = getPoopsFromUserWithFilter(id, year, month)
	const poopAverage = parseFloat((poops.length / daysConsidered).toFixed(2))

	return { monthlyLeaderboardPosition, streak, poopAverage }
}

function poopStats() {
	const now = new Date()
	const todayStart = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	)
	const todayEnd = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			23,
			59,
			59,
			999
		)
	)

	// Calculate start of the week and start of the month in UTC
	const startOfWeek = new Date(todayStart)
	startOfWeek.setUTCDate(todayStart.getUTCDate() - todayStart.getUTCDay())

	const startOfMonth = new Date(todayStart)
	startOfMonth.setUTCDate(1)

	// Convert dates to ISO strings
	const today = todayStart.toISOString()
	const todayEndSqlite = todayEnd.toISOString()
	const weekStart = startOfWeek.toISOString()
	const monthStart = startOfMonth.toISOString()

	// Query the database
	const todayPoops = db
		.prepare(
			`SELECT COUNT(*) as today FROM poop WHERE timestamp BETWEEN ? AND ?`
		)
		.get(today, todayEndSqlite)

	const weeklyPoops = db
		.prepare(`SELECT COUNT(*) as week FROM poop WHERE timestamp >= ?`)
		.get(weekStart)

	const monthlyPoops = db
		.prepare(`SELECT COUNT(*) as month FROM poop WHERE timestamp >= ?`)
		.get(monthStart)

	const totalPoops = db.prepare(`SELECT COUNT(*) as total FROM poop`).get()

	return {
		day: todayPoops.today,
		week: weeklyPoops.week,
		month: monthlyPoops.month,
		total: totalPoops.total,
	}
}

function updateUsername(id, username) {
	db.prepare(
		`
        UPDATE user
        SET username = ?
        WHERE id = ?
    `
	).run(username, id)
}

function updateProfilePicture(id, picture) {
	db.prepare(
		`
        UPDATE user
        SET pfp = ?
        WHERE id = ?
    `
	).run(picture, id)
}

function updateBio(id, bio) {
	db.prepare(
		`
		UPDATE user
		SET bio = ?
		WHERE id = ?
	`
	).run(bio, id)
}

function sanitizePhone(phone) {
	return phone.match(/^\d+/)[0]
}

function hashId(id) {
	return crypto.createHash('md5').update(id.match(/^\d+/)[0]).digest('hex')
}

function rawQuery(query) {
	if (query.toLowerCase().startsWith('select')) {
		return db.prepare(query).all()
	} else {
		return db.prepare(query).run()
	}
}

module.exports = {
	initDatabase,
	login,
	updatePassword,
	addPoop,
	poopLeaderboard,
	poopLeaderboardWithFilter,
	poopStreak,
	poopStats,
	poopStatsFromUser,
	poopStatsFromUserWithFilter,
	allPoop,
	allPoopWithFilter,
	updateUsername,
	updateProfilePicture,
	updateBio,
	getLastPoop,
	getUserByToken,
	getUserProfileById,
	getUserProfileByUsername,
	getUserProfileByPhone,
	createUser,
	getPoopsFromUser,
	getPoopsFromUserWithFilter,
	addPoopWithTimestamp,
	setMoney,
	getRarities,
	getCollectibles,
	addCollectibleToUser,
	getUserCollectibles,
	rawQuery,
}
