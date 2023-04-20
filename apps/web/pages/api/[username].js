export default function handler(req, res) {
  console.log(req.body, req.param);
  res.status(200).json({ name: "John ssss" + req.params.username });
}
