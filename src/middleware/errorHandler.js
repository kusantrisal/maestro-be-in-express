module.exports = (err, req, res, next) => {
    res.status(err.status || res.statusCode || 500);
    res.json({ error: err.message });
};