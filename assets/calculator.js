(function () {
  var MACLESS_PRICE = 99;

  var monthlyInput = document.getElementById('monthlyCost');
  var monthsInput = document.getElementById('monthsPaying');
  var presetBtns = document.querySelectorAll('.preset-btn');
  var stepperBtns = document.querySelectorAll('.stepper-btn');
  var copyBtn = document.getElementById('copyBtn');
  var copyStatus = document.getElementById('copyStatus');

  var spentSoFarEl = document.getElementById('spentSoFar');
  var yearlyCostEl = document.getElementById('yearlyCost');
  var breakEvenEl = document.getElementById('breakEven');
  var savedThisYearEl = document.getElementById('savedThisYear');

  function fmtMoney(n) {
        n = Math.round(n);
    return '$' + n.toLocaleString('en-US');
  }

  function clampNonNegative(n) {
        if (isNaN(n) || n < 0) return 0;
    return n;
  }

  function recalc() {
        var monthly = clampNonNegative(parseFloat(monthlyInput.value));
    var months = clampNonNegative(parseFloat(monthsInput.value));

    var spentSoFar = monthly * months;
    var yearlyCost = monthly * 12;
    var savedThisYear = yearlyCost - MACLESS_PRICE;

    var breakEvenDays;
    if (monthly <= 0) {
      breakEvenDays = null;
    } else {
      var dailyRate = monthly / 30;
      breakEvenDays = Math.ceil(MACLESS_PRICE / dailyRate);
    }

    spentSoFarEl.textContent = fmtMoney(spentSoFar);
    yearlyCostEl.textContent = fmtMoney(yearlyCost);
    savedThisYearEl.textContent = savedThisYear >= 0 ? fmtMoney(savedThisYear) : fmtMoney(0);

    if (breakEvenDays === null) {
      breakEvenEl.textContent = 'n/a';
    } else if (breakEvenDays <= 0) {
      breakEvenEl.textContent = 'already';
    } else {
      breakEvenEl.textContent = breakEvenDays + ' day' + (breakEvenDays === 1 ? '' : 's');
    }

    presetBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-value') === String(monthlyInput.value));
    });
  }

  monthlyInput.addEventListener('input', recalc);
  monthsInput.addEventListener('input', recalc);

  presetBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
                monthlyInput.value = btn.getAttribute('data-value');
      recalc();
        });
  });

  stepperBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var field = btn.parentElement.querySelector('input[type="number"]');
      if (!field) return;
      var dir = parseInt(btn.getAttribute('data-step'), 10) || 0;
      var step = parseFloat(field.step) || 1;
      var min = field.hasAttribute('min') ? parseFloat(field.min) : -Infinity;
      var next = (parseFloat(field.value) || 0) + dir * step;
      if (next < min) next = min;
      field.value = next;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  copyBtn.addEventListener('click', function () {
        var monthly = clampNonNegative(parseFloat(monthlyInput.value));
    var months = clampNonNegative(parseFloat(monthsInput.value));
    var spentSoFar = Math.round(monthly * months);
    var yearlyCost = Math.round(monthly * 12);

    var text = "I've spent " + fmtMoney(spentSoFar) + " on Mac rental/CI to ship iOS apps ("
      + fmtMoney(yearlyCost) + "/year at this rate). Could've paid $99 once instead — macless.dev";

    function showCopied() {
            copyStatus.textContent = 'Copied.';
      setTimeout(function () { copyStatus.textContent = ''; }, 2500);
        }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied, function () {
                copyStatus.textContent = 'Could not copy — select and copy manually.';
      });
    } else {
      copyStatus.textContent = 'Copy not supported in this browser.';
    }
    });

  recalc();
  })();
