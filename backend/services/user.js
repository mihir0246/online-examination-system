export const userdetails = (req, res, next) => {
  res.json({
    success: true,
    message: 'Success',
    user: {
      id: req.user.id,
      name: req.user.name,
      type: req.user.type,
      emailid: req.user.emailid,
      contact: req.user.contact
    }
  });
};