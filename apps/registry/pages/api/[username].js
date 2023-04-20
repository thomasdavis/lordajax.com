export default function handler(req, res) {
  console.log(req.body, req.param);
  res.status(200).json({ name: "reg ssss" + req.query.username });
}
