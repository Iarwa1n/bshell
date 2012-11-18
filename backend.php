<?


function getHistory() {
	if (file_exists("shell.history")) {
		return json_decode(file_get_contents("shell.history"), true);
	}
	return array();
}

global $h;

$v = array("x" => 100);
$c =  array();
$h = getHistory();

function saveHistory($history)
{

	file_put_contents("shell.history", json_encode($history));
}

$c['test'] = function($cmd, $input, $params) {
	return "Input: " . implode('-', $input) . " - Params: " . serialize($params);
};


$c['max'] = function($cmd, $input, $params) {
	$max = $input[0];
	foreach ($input as $_input) {
		$max = ($_input > $max) ? $_input: $max;
	}
	return $max;
};

// loads a web url and returns its html

$c['load'] = function($cmd, $input, $params) {
	if (count($input) !== 1) {
		return "give exactly one url";
	}
	$html = file_get_contents($input[0]);
	$html = str_replace("href=\"/", "href=\"" . $input[0] . "/", $html);
	$html = str_replace("src=\"/", "src=\"" . $input[0] . "/", $html);
	return $html;
};

$c['history'] = function($cmd, $input, $params) {
	global $h;
	return $h[$input[0]];
};

$c['save_history'] = function($cmd, $input, $params)
{
	global $h;
	$h[count($h)+1] = implode(" ", $input);
	return "history added";
};

$cmd = $_REQUEST['cmd'];

$input = explode(' ', $_REQUEST['input']);

$params = $_REQUEST;
unset($params['cmd']);
unset($params['input']);
function execute($cmd, $input, $params, $v, $c)
{
		foreach($input as &$_input) {
			if (preg_match('/^\$/', $_input) && array_key_exists(substr($_input, 1), $v)) {
				//echo substr($_input, 1);
				$_input = $v[substr($_input, 1)];
			}
		}
		if ($func = $c[$cmd]) {
			return $func($cmd, $input, $params);			
		}
}
echo execute($cmd, $input, $params, $v, $c);

saveHistory($h);
?>