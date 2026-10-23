/* Reusable searchable State -> City dropdowns, backed by assets/data/in-states-cities.json */
(function (window) {
    'use strict';

    var DATA_URL = 'assets/data/in-states-cities.json';
    var dataPromise = null;

    function loadData() {
        if (!dataPromise) {
            dataPromise = fetch(DATA_URL).then(function (res) { return res.json(); });
        }
        return dataPromise;
    }

    function init(stateSelectEl, citySelectEl) {
        var stateChoices = new Choices(stateSelectEl, {
            searchEnabled: true,
            shouldSort: false,
            itemSelectText: '',
            placeholderValue: 'Select State'
        });
        var cityChoices = new Choices(citySelectEl, {
            searchEnabled: true,
            shouldSort: false,
            itemSelectText: '',
            placeholderValue: 'Select City'
        });
        cityChoices.setChoices([{ value: '', label: 'Select City', placeholder: true, selected: true }], 'value', 'label', true);
        cityChoices.disable();

        var codeByState = {};
        var citiesByCode = {};

        function citiesFor(stateName) {
            var code = codeByState[stateName];
            return (code && citiesByCode[code]) || [];
        }

        function populateCities(stateName, selectedCity) {
            var cities = citiesFor(stateName);
            var options = [{ value: '', label: 'Select City', placeholder: true, selected: !selectedCity }]
                .concat(cities.map(function (city) {
                    return { value: city, label: city, selected: city === selectedCity };
                }));
            cityChoices.clearStore();
            cityChoices.setChoices(options, 'value', 'label', true);
            if (cities.length) {
                cityChoices.enable();
            } else {
                cityChoices.disable();
            }
        }

        function populateStates(data) {
            citiesByCode = data.cities;
            var stateOptions = [{ value: '', label: 'Select State', placeholder: true, selected: true }]
                .concat(data.states.map(function (state) {
                    codeByState[state.name] = state.code;
                    return { value: state.name, label: state.name };
                }));
            stateChoices.clearStore();
            stateChoices.setChoices(stateOptions, 'value', 'label', true);
        }

        stateSelectEl.addEventListener('change', function () {
            populateCities(stateSelectEl.value, null);
        });

        // Choices.js resets its own choice list to empty whenever the containing
        // <form> fires a native "reset" event, so it must be repopulated after that.
        loadData().then(populateStates);

        return {
            setValue: function (stateName, cityName) {
                loadData().then(function () {
                    stateChoices.setChoiceByValue(stateName);
                    populateCities(stateName, cityName);
                    cityChoices.setChoiceByValue(cityName);
                });
            },
            reset: function () {
                loadData().then(populateStates);
                cityChoices.setChoices([{ value: '', label: 'Select City', placeholder: true, selected: true }], 'value', 'label', true);
                cityChoices.disable();
            }
        };
    }

    window.StateCity = { init: init };
})(window);
