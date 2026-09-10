const getHealth = (req, res) => {
  res.status(200).json({
    status: "UP",
    service: "smart-canteen-backend",
  });
};

module.exports = { getHealth };
